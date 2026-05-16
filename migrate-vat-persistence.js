const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runVatMigration() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Migración de Campos de IVA y Neto ---');
    
    await client.query('BEGIN');

    // 1. Agregar columnas si no existen
    await client.query(`
      ALTER TABLE public.cuentas_detalle ADD COLUMN IF NOT EXISTS subtotal_neto NUMERIC DEFAULT 0;
      ALTER TABLE public.cuentas_detalle ADD COLUMN IF NOT EXISTS iva_monto NUMERIC DEFAULT 0;
      ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS total_neto NUMERIC DEFAULT 0;
      ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS total_iva NUMERIC DEFAULT 0;
    `);
    console.log('✅ Columnas agregadas a cuentas y cuentas_detalle.');

    // 2. Poblar datos históricos en cuentas_detalle
    await client.query(`
      UPDATE public.cuentas_detalle 
      SET 
        subtotal_neto = ROUND((precio_venta * cantidad_vendida) / 1.13, 2),
        iva_monto = ROUND((precio_venta * cantidad_vendida) - ((precio_venta * cantidad_vendida) / 1.13), 2)
      WHERE subtotal_neto = 0;
    `);
    console.log('✅ Campos neto e IVA sincronizados en cuentas_detalle.');

    // 3. Poblar datos históricos en cuentas
    await client.query(`
      UPDATE public.cuentas c 
      SET 
        total_neto = COALESCE((SELECT SUM(subtotal_neto) FROM public.cuentas_detalle cd WHERE cd.cuenta_id = c.id), ROUND(total / 1.13, 2)),
        total_iva = COALESCE((SELECT SUM(iva_monto) FROM public.cuentas_detalle cd WHERE cd.cuenta_id = c.id), ROUND(total - (total / 1.13), 2))
      WHERE total_neto = 0;
    `);
    console.log('✅ Campos neto e IVA sincronizados en tabla cuentas.');

    await client.query('COMMIT');
    console.log('--- Migración Finalizada Exitosamente ---');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error en migración:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

runVatMigration();

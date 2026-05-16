const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Migración de Columnas de Descuento ---');
    
    await client.query('BEGIN');

    // 1. Agregar columnas si no existen
    await client.query(`
      ALTER TABLE public.cuentas_detalle ADD COLUMN IF NOT EXISTS precio_original NUMERIC DEFAULT 0;
      ALTER TABLE public.cuentas_detalle ADD COLUMN IF NOT EXISTS monto_descuento NUMERIC DEFAULT 0;
      ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS descuento_total NUMERIC DEFAULT 0;
    `);
    console.log('✅ Columnas agregadas a cuentas y cuentas_detalle.');

    // 2. Poblar precio_original basado en el precio de venta actual (para datos históricos)
    await client.query(`
      UPDATE public.cuentas_detalle cd 
      SET precio_original = p.precio_venta 
      FROM public.productos p 
      WHERE cd.producto_id = p.id AND cd.precio_original = 0;
    `);
    console.log('✅ precio_original sincronizado para registros antiguos.');

    // 3. Calcular monto_descuento histórico
    await client.query(`
      UPDATE public.cuentas_detalle 
      SET monto_descuento = (precio_original - precio_venta) * cantidad_vendida 
      WHERE monto_descuento = 0 AND precio_original > precio_venta;
    `);
    console.log('✅ monto_descuento calculado para registros antiguos.');

    // 4. Calcular descuento_total en cuentas
    await client.query(`
      UPDATE public.cuentas c 
      SET descuento_total = COALESCE((
        SELECT SUM(monto_descuento) 
        FROM public.cuentas_detalle cd 
        WHERE cd.cuenta_id = c.id
      ), 0);
    `);
    console.log('✅ descuento_total sincronizado en tabla cuentas.');

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

runMigrations();

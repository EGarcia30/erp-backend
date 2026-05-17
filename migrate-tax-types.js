const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateTaxTypes() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Crear tabla
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tipo_impuesto (
        codigo VARCHAR(1) PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL
      );
      INSERT INTO public.tipo_impuesto (codigo, nombre) VALUES 
      ('1', 'Gravado'), 
      ('2', 'Exento'), 
      ('3', 'No Sujeto')
      ON CONFLICT (codigo) DO NOTHING;
    `);

    // 2. Modificar columna tipo_impuesto en productos para que sea FK
    // Primero, asegurar que los datos existentes sean válidos
    await client.query("UPDATE public.productos SET tipo_impuesto = '1' WHERE tipo_impuesto IS NULL OR tipo_impuesto NOT IN ('1','2','3');");
    
    await client.query(`
      ALTER TABLE public.productos 
      ALTER COLUMN tipo_impuesto TYPE VARCHAR(1);
      
      -- Asegurar FK
      ALTER TABLE public.productos 
      ADD CONSTRAINT fk_productos_tipo_impuesto 
      FOREIGN KEY (tipo_impuesto) REFERENCES public.tipo_impuesto(codigo);
    `);

    await client.query('COMMIT');
    console.log('✅ Tabla tipo_impuesto creada y productos vinculados correctamente.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error en migración:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateTaxTypes();

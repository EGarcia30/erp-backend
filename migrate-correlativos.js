const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Migración de Correlativos ---');
    
    await client.query('BEGIN');

    // 1. Crear tabla de correlativos
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.dte_correlativos (
        tipo_dte VARCHAR(2) PRIMARY KEY REFERENCES public.tipo_dte(codigo),
        ultimo_correlativo BIGINT DEFAULT 0
      );
    `);
    console.log('✅ Tabla public.dte_correlativos verificada/creada.');

    // 2. Inicializar con los tipos de DTE existentes
    await client.query(`
      INSERT INTO public.dte_correlativos (tipo_dte, ultimo_correlativo)
      SELECT codigo, 0 FROM public.tipo_dte
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Inicialización de tipos de DTE completada.');

    // 3. (Opcional) Migrar correlativos actuales si ya hay facturas?
    // En este caso, como el usuario menciona que el problema está ocurriendo ahora, 
    // podríamos intentar sincronizar el ultimo_correlativo con el máximo encontrado en cuentas
    // Pero el usuario dice que "no se respeta", así que mejor empezar limpio o bajo demanda.
    // Vamos a sincronizar para no repetir números si ya hay facturas generadas.
    
    const tipos = await client.query('SELECT codigo FROM public.tipo_dte');
    for (const row of tipos.rows) {
      const tipo = row.codigo;
      // Extraer el correlativo actual de numero_control si existe (formato DTE-XX-YYYY-ZZZZZZZZZZZZZZZ)
      // El correlativo está en la última parte (15 dígitos)
      await client.query(`
        UPDATE public.dte_correlativos
        SET ultimo_correlativo = COALESCE((
          SELECT MAX(CAST(RIGHT(numero_control, 15) AS BIGINT))
          FROM public.cuentas
          WHERE tipo_dte = $1 AND numero_control LIKE 'DTE-%'
        ), 0)
        WHERE tipo_dte = $1;
      `, [tipo]);
    }
    console.log('✅ Sincronización de correlativos actuales completada.');

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

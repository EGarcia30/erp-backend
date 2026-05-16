const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkLastAccount() {
  const client = await pool.connect();
  try {
    console.log('--- Verificando Última Cuenta ---');
    
    // 1. Obtener la última cuenta
    const cuentaRes = await client.query(`
      SELECT id, total, estado, numero_control, json_dte 
      FROM public.cuentas 
      ORDER BY id DESC LIMIT 1
    `);
    const cuenta = cuentaRes.rows[0];

    if (!cuenta) {
      console.log('No se encontraron cuentas.');
      return;
    }

    console.log(`Cuenta ID: ${cuenta.id}`);
    console.log(`Numero Control: ${cuenta.numero_control}`);
    console.log(`Total: ${cuenta.total}`);
    console.log(`Estado: ${cuenta.estado}`);

    // 2. Obtener abonos
    const abonosRes = await client.query(`
      SELECT total_abonado, forma_pago_id 
      FROM public.abonos_cuenta 
      WHERE cuenta_id = $1
    `, [cuenta.id]);
    
    console.log(`Número de abonos encontrados: ${abonosRes.rows.length}`);
    abonosRes.rows.forEach((a, i) => {
      console.log(`  Abono ${i+1}: $${a.total_abonado} (Forma Pago ID: ${a.forma_pago_id})`);
    });

    // 3. Verificar JSON DTE
    if (cuenta.json_dte && cuenta.json_dte.resumen && cuenta.json_dte.resumen.pagos) {
      console.log('Pagos en JSON DTE:');
      console.log(JSON.stringify(cuenta.json_dte.resumen.pagos, null, 2));
      
      const totalPagosJson = cuenta.json_dte.resumen.pagos.reduce((acc, p) => acc + p.montoPagado, 0);
      console.log(`Total Pagos en JSON: $${totalPagosJson}`);
      
      if (Math.abs(totalPagosJson - parseFloat(cuenta.total)) < 0.01) {
        console.log('✅ El total de pagos en el JSON coincide con el total de la cuenta.');
      } else {
        console.log('❌ El total de pagos en el JSON NO coincide con el total de la cuenta.');
      }
    } else {
      console.log('El JSON DTE no tiene información de pagos aún.');
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

checkLastAccount();

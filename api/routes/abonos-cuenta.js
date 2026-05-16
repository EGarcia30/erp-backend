const express = require("express");
const router = express.Router();
const db = require("../config/database");

const dteUtils = require("../utils/dteUtils");

// ✅ POST /abonos-cuenta - Motor Fiscal Integrado (HU7668)
router.post("/", async (req, res) => {
  const { cuenta_id, total_abonado, forma_pago_id, referencia, nota } = req.body;

  if (!cuenta_id || !total_abonado || !forma_pago_id) {
    return res.status(400).json({ success: false, error: "Faltan campos requeridos" });
  }

  const fechaActual = new Date().toLocaleDateString('sv-SV', { 
            timeZone: 'America/El_Salvador',
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).split('/').reverse().join('-');

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Bloquear cuenta
    const cuenta = await client.query(
      `SELECT id, total, estado, tipo_pago FROM public.cuentas WHERE id = $1 FOR UPDATE`,
      [cuenta_id]
    );

    if (cuenta.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Cuenta no encontrada" });
    }

    if (cuenta.rows[0].estado === "pagado") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "La cuenta ya está pagada" });
    }

    // 2. Validar forma_pago
    const formaPago = await client.query(
      "SELECT id FROM public.forma_pago WHERE id = $1",
      [forma_pago_id]
    );

    if (formaPago.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "Forma de pago inválida" });
    }

    // 3. Insertar abono
    const abono = await client.query(
      `INSERT INTO public.abonos_cuenta (
          cuenta_id,
          total_abonado,
          forma_pago_id,
          referencia,
          nota,
          fecha_pago
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, cuenta_id, total_abonado`,
      [cuenta_id, total_abonado, forma_pago_id, referencia, nota, fechaActual]
    );

    // 4. Actualizar tabla cuentas
    const cuentaActualizada = await client.query(
      `UPDATE public.cuentas
       SET
         total_pagado = COALESCE((
           SELECT SUM(total_abonado)
           FROM public.abonos_cuenta
           WHERE cuenta_id = $1
         ), 0),
         total_pendiente = GREATEST($2::numeric - COALESCE((
           SELECT SUM(total_abonado)
           FROM public.abonos_cuenta
           WHERE cuenta_id = $1
         ), 0), 0),
         total_vuelto = GREATEST(COALESCE((
           SELECT SUM(total_abonado)
           FROM public.abonos_cuenta
           WHERE cuenta_id = $1
         ), 0) - $2::numeric, 0),
         estado = CASE
           WHEN $2::numeric <= COALESCE((
                 SELECT SUM(total_abonado)
                 FROM public.abonos_cuenta
                 WHERE cuenta_id = $1
               ), 0) THEN 'pagado'
           ELSE 'pendiente'
         END
       WHERE id = $1
       RETURNING id, cliente, total, total_pagado, total_pendiente, total_vuelto, estado, tipo_dte`,
      [cuenta_id, cuenta.rows[0].total]
    );

    const cuentaData = cuentaActualizada.rows[0];

    await client.query("COMMIT");
    client.release(); // Liberamos el cliente antes de la lógica DTE

    let dteResult = null;

    // 🚀 LÓGICA DTE AUTOMÁTICA (HU7668) - FUERA DE LA TRANSACCIÓN
    if (cuentaData.estado === 'pagado') {
        try {
            // A. Generar JSON (Ahora sí verá todos los abonos porque ya se hizo COMMIT)
            const jsonDte = await dteUtils.generarJSONDTE(cuenta_id);

            // B. Generar PDF
            const pdfBuffer = await dteUtils.generarPDF(jsonDte);            
            // C. Generar Ticket (Texto)
            const ticketTexto = await dteUtils.generarTicketTexto(jsonDte);

            // D. Actualizar cuenta con el JSON y estado fiscal
            await db.query(
                `UPDATE public.cuentas 
                 SET json_dte = $1, estado_dte = 'procesado', fecha_emision = NOW() 
                 WHERE id = $2`,
                [JSON.stringify(jsonDte), cuenta_id]
            );

            // E. Intentar enviar correo (asíncrono)
            dteUtils.enviarCorreo(jsonDte, pdfBuffer).catch(e => console.error("Error envío correo:", e));

            dteResult = {
                json: jsonDte,
                ticket: ticketTexto,
                pdfBase64: pdfBuffer.toString('base64')
            };
        } catch (dteError) {
            console.error("⚠️ Error generando DTE:", dteError.message);
        }
    }

    res.json({
      success: true,
      data: {
        abono: abono.rows[0],
        cuenta: {
          id: parseInt(cuentaData.id),
          cliente: cuentaData.cliente,
          total: parseFloat(cuentaData.total),
          total_pagado: parseFloat(cuentaData.total_pagado),
          total_pendiente: parseFloat(cuentaData.total_pendiente),
          total_vuelto: parseFloat(cuentaData.total_vuelto),
          estado: cuentaData.estado
        },
        dte: dteResult
      }
    });
  } catch (error) {
    if (client) {
        try { await client.query("ROLLBACK"); } catch (rbError) { /* ignore */ }
        client.release();
    }
    console.error("❌ ERROR:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ GET /api/abonos-cuenta/cuenta/:cuenta_id - Listar abonos de una cuenta
router.get("/cuenta/:cuenta_id", async (req, res) => {
  const { cuenta_id } = req.params;

  try {
    const abonos = await db.query(
      `SELECT
          a.id,
          a.total_abonado,
          a.forma_pago_id,
          a.referencia,
          a.nota,
          a.fecha_pago,
          fp.codigo as forma_pago_codigo,
          fp.nombre as forma_pago_nombre
       FROM public.abonos_cuenta a
       JOIN public.forma_pago fp ON a.forma_pago_id = fp.id
       WHERE a.cuenta_id = $1
       ORDER BY a.fecha_pago DESC`,
      [cuenta_id]
    );

    res.json({
      success: true,
      data: abonos.rows,
    });
  } catch (error) {
    console.error("🚨 ERROR GET abonos cuenta:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;

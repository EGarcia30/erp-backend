const db = require('../config/database');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

/**
 * Utilidades para la gestión de DTE (Documentos Tributarios Electrónicos)
 * Ministerio de Hacienda - El Salvador
 */

const dteUtils = {

    /**
     * Genera el JSON completo del DTE según el esquema de Hacienda
     */
    async generarJSONDTE(cuentaId) {
        try {
            // 1. Obtener toda la información necesaria con descripciones de actividad
            const [cuentaRes, detallesRes, emisorRes, abonosRes] = await Promise.all([
                db.query(`SELECT c.*, cl.nombre as cl_nombre, cl.num_documento as cl_doc, 
                          cl.nrc as cl_nrc, cl.cod_actividad as cl_actividad, 
                          ae.descripcion as cl_actividad_desc,
                          cl.direccion as cl_direccion, cl.correo as cl_correo,
                          cl.departamento_cod as cl_dep, cl.municipio_cod as cl_mun,
                          td.nombre as cl_tipo_doc_nombre
                          FROM public.cuentas c 
                          LEFT JOIN public.clientes cl ON c.cliente_id = cl.id
                          LEFT JOIN public.tipo_documento td ON cl.tipo_documento = td.codigo
                          LEFT JOIN public.actividad_economica ae ON cl.cod_actividad = ae.codigo
                          WHERE c.id = $1`, [cuentaId]),
                db.query(`SELECT cd.*, p.descripcion, p.unidad_medida_id, um.codigo as um_cod, 
                          ti.codigo as ti_cod
                          FROM public.cuentas_detalle cd
                          JOIN public.productos p ON cd.producto_id = p.id
                          LEFT JOIN public.unidades_medida um ON p.unidad_medida_id = um.id
                          LEFT JOIN public.tipo_item ti ON p.tipo_item_id = ti.id
                          WHERE cd.cuenta_id = $1`, [cuentaId]),
                db.query(`SELECT e.*, ae.descripcion as actividad_desc 
                          FROM public.configuracion_empresa e
                          LEFT JOIN public.actividad_economica ae ON e.cod_actividad = ae.codigo
                          LIMIT 1`),
                db.query(`SELECT a.*, fp.codigo as fp_cod 
                          FROM public.abonos_cuenta a 
                          JOIN public.forma_pago fp ON a.forma_pago_id = fp.id
                          WHERE a.cuenta_id = $1`, [cuentaId])
            ]);

            const cuenta = cuentaRes.rows[0];
            const detalles = detallesRes.rows;
            const emisor = emisorRes.rows[0];
            const abonos = abonosRes.rows;

            if (!cuenta || !emisor) throw new Error("Datos insuficientes para generar DTE");

            const fecha = new Date();
            const fechaIso = fecha.toISOString().split('T')[0];
            const horaIso = fecha.toTimeString().split(' ')[0];

            // 2. Estructura base del JSON (v1)
            const dte = {
                identificacion: {
                    version: 1,
                    ambiente: cuenta.ambiente,
                    tipoDte: cuenta.tipo_dte || "01",
                    numeroControl: cuenta.numero_control,
                    codigoGeneracion: cuenta.codigo_generacion,
                    tipoModelo: parseInt(cuenta.tipo_modelo),
                    tipoOperacion: parseInt(cuenta.tipo_operacion),
                    tipoContingencia: null,
                    motivoContin: null,
                    fecEmi: fechaIso,
                    horEmi: horaIso,
                    tipoMoneda: "USD"
                },
                emisor: {
                    nit: emisor.num_documento.replace(/-/g, ''),
                    nrc: emisor.nrc.replace(/-/g, ''),
                    nombre: emisor.nombre_legal,
                    codActividad: emisor.cod_actividad,
                    descActividad: emisor.actividad_desc || "Otras actividades de servicios n.c.p.",
                    nombreComercial: emisor.nombre_comercial,
                    tipoEstablecimiento: emisor.tipo_establecimiento,
                    direccion: {
                        departamento: emisor.departamento_cod,
                        municipio: emisor.municipio_cod,
                        complemento: emisor.direccion
                    },
                    telefono: emisor.telefono,
                    correo: emisor.correo,
                    codEstableMH: emisor.cod_estable_mh,
                    codEstable: emisor.cod_estable,
                    codPuntoVentaMH: emisor.cod_punto_venta_mh,
                    codPuntoVenta: emisor.cod_punto_venta
                },
                receptor: {
                    tipoDocumento: cuenta.cl_doc ? (cuenta.tipo_dte === '01' ? '13' : '36') : null,
                    numDocumento: cuenta.cl_doc || null,
                    nrc: cuenta.cl_nrc || null,
                    nombre: cuenta.cl_nombre || cuenta.cliente || "Consumidor Final",
                    codActividad: cuenta.cl_actividad || null,
                    descActividad: cuenta.cl_actividad_desc || null,
                    direccion: cuenta.cl_direccion ? {
                        departamento: cuenta.cl_dep,
                        municipio: cuenta.cl_mun,
                        complemento: cuenta.cl_direccion
                    } : null,
                    telefono: cuenta.cl_telefono || null,
                    correo: cuenta.cl_correo || null
                },
                cuerpoDocumento: detalles.map((d, idx) => ({
                    numItem: idx + 1,
                    tipoItem: parseInt(d.ti_cod) || 1,
                    numeroDocumento: null,
                    cantidad: parseFloat(d.cantidad_vendida),
                    codigo: d.producto_id.toString(),
                    codTributo: null,
                    uniMedida: parseInt(d.um_cod) || 59,
                    descripcion: d.descripcion,
                    precioUni: parseFloat(d.precio_venta) / 1.13,
                    montoDescu: 0,
                    ventaNoSuj: 0,
                    ventaExenta: 0,
                    ventaGravada: parseFloat(d.precio_venta) * parseFloat(d.cantidad_vendida) / 1.13,
                    tributos: ["20"],
                    psv: 0,
                    noGravado: 0,
                    ivaItem: (parseFloat(d.precio_venta) * parseFloat(d.cantidad_vendida)) - (parseFloat(d.precio_venta) * parseFloat(d.cantidad_vendida) / 1.13)
                })),
                resumen: {
                    totalNoSuj: 0,
                    totalExenta: 0,
                    totalGravada: parseFloat(cuenta.total) / 1.13,
                    subTotalVentasSinIva: parseFloat(cuenta.total) / 1.13,
                    descuNoSuj: 0,
                    descuExenta: 0,
                    descuGravada: 0,
                    totalDescu: 0,
                    tributos: [{
                        codigo: "20",
                        descripcion: "IVA 13%",
                        valor: parseFloat(cuenta.total) - (parseFloat(cuenta.total) / 1.13)
                    }],
                    subTotal: parseFloat(cuenta.total),
                    ivaPerci1: 0,
                    ivaReteni1: 0,
                    retenMonto1: 0,
                    montoTotalOperacion: parseFloat(cuenta.total),
                    totalNoGravado: 0,
                    totalPagar: parseFloat(cuenta.total),
                    totalLetras: "DOLARES DE LOS ESTADOS UNIDOS DE AMERICA",
                    saldoFavor: 0,
                    condicionOperacion: cuenta.tipo_pago === 'credito' ? 2 : 1,
                    pagos: abonos.map(a => ({
                        codigo: a.fp_cod || "01",
                        montoPagado: parseFloat(a.total_abonado),
                        referencia: a.referencia || null,
                        plazo: null,
                        periodo: null
                    }))
                },
                extension: null,
                apendice: null
            };

            return dte;
        } catch (error) {
            console.error("Error generando JSON DTE:", error);
            throw error;
        }
    },

    /**
     * Genera un string formateado para impresora térmica (Ticket Pro)
     */
    async generarTicketTexto(dte) {
        const line = "-".repeat(32);
        const dline = "=".repeat(32);
        
        let ticket = "";
        ticket += `${dte.emisor.nombreComercial || dte.emisor.nombre}\n`.toUpperCase();
        ticket += `NIT: ${dte.emisor.nit}\nNRC: ${dte.emisor.nrc}\n`;
        ticket += `${dte.emisor.direccion.complemento.substring(0, 32)}\n`;
        ticket += `${line}\n`;
        ticket += `${dte.identificacion.tipoDte === '01' ? 'FACTURA ELECTRONICA' : 'CREDITO FISCAL ELEC.'}\n`;
        ticket += `MOD: ${dte.identificacion.tipoModelo === 1 ? 'Previo' : 'Diferido'} | VER: ${dte.identificacion.version}\n`;
        ticket += `Cod. Gen: ${dte.identificacion.codigoGeneracion}\n`;
        ticket += `Num. Con: ${dte.identificacion.numeroControl}\n`;
        ticket += `Fecha: ${dte.identificacion.fecEmi} ${dte.identificacion.horEmi}\n`;
        ticket += `${line}\n`;
        ticket += `CLIENTE: ${dte.receptor.nombre.substring(0, 23).toUpperCase()}\n`;
        if (dte.receptor.numDocumento) ticket += `DOC: ${dte.receptor.numDocumento}\n`;
        ticket += `${line}\n`;
        ticket += `CANT  DESCRIPCION       TOTAL\n`;
        
        dte.cuerpoDocumento.forEach(item => {
            const desc = item.descripcion.substring(0, 15).padEnd(16);
            const total = (item.ventaGravada + item.ivaItem).toFixed(2).padStart(8);
            ticket += `${item.cantidad.toString().padEnd(5)} ${desc} ${total}\n`;
        });
        
        ticket += `${dline}\n`;
        ticket += `TOTAL A PAGAR:      $${dte.resumen.totalPagar.toFixed(2).padStart(8)}\n`;
        ticket += `${dline}\n`;
        ticket += `Gracias por su preferencia\n`;
        ticket += `Validar en: https://consultadte.mh.gob.sv\n`;
        
        return ticket;
    },

    /**
     * Genera un PDF profesional (basado en PedidosYa / DTE Estándar)
     */
    async generarPDF(dte) {
        const qrBuffer = await QRCode.toBuffer(`https://consultadte.mh.gob.sv/consulta/${dte.identificacion.codigoGeneracion}`);
        
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ 
                margin: 40,
                size: 'LETTER',
                info: { Title: `DTE-${dte.identificacion.numeroControl}` }
            });
            
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // ─── CONFIGURACIÓN VISUAL ───
            const primaryColor = '#2D3436';
            const accentColor = '#D63031'; // Rojo elegante (tipo PedidosYa)
            const secondaryColor = '#636E72';
            const borderColor = '#DFE6E9';
            const lightBg = '#F9F9F9';

            // ─── HEADER SUPERIOR ───
            doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold').text('DOCUMENTO TRIBUTARIO ELECTRÓNICO', 200, 40, { align: 'center' });
            doc.fillColor(primaryColor).fontSize(18).text(dte.identificacion.tipoDte === '01' ? 'FACTURA' : 'COMPROBANTE DE CRÉDITO FISCAL', { align: 'center' });
            doc.fontSize(8).font('Helvetica').fillColor(secondaryColor).text(`Versión: ${dte.identificacion.version}`, { align: 'right' });

            doc.image(qrBuffer, 270, 85, { width: 75 });

            doc.fontSize(8).fillColor(primaryColor);
            doc.font('Helvetica-Bold').text('Código de generación:', 40, 85);
            doc.font('Helvetica').text(dte.identificacion.codigoGeneracion, 40, 95);
            doc.font('Helvetica-Bold').text('Número de control:', 40, 110);
            doc.font('Helvetica').text(dte.identificacion.numeroControl, 40, 120);
            doc.font('Helvetica-Bold').text('Sello de recepción:', 40, 135);
            doc.font('Helvetica').fillColor(secondaryColor).text('PENDIENTE DE TRANSMISIÓN', 40, 145);

            doc.fillColor(primaryColor).font('Helvetica-Bold').text('Modelo de facturación:', 410, 85);
            doc.font('Helvetica').text(dte.identificacion.tipoModelo === 1 ? 'Modelo Facturación previo' : 'Diferido', 515, 85, { align: 'right' });
            doc.font('Helvetica-Bold').text('Tipo de transmisión:', 410, 100);
            doc.font('Helvetica').text(dte.identificacion.tipoOperacion === 1 ? 'Transmisión normal' : 'Contingencia', 515, 100, { align: 'right' });
            doc.font('Helvetica-Bold').text('Fecha y hora generación:', 410, 115);
            doc.font('Helvetica').text(`${dte.identificacion.fecEmi} ${dte.identificacion.horEmi}`, 515, 115, { align: 'right' });

            // ─── SECCIONES EMISOR / RECEPTOR ───
            const boxY = 175;
            const boxHeight = 115;
            doc.roundedRect(40, boxY, 260, boxHeight, 4).lineWidth(0.5).strokeColor(borderColor).stroke();
            doc.roundedRect(310, boxY, 260, boxHeight, 4).stroke();

            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(9).text('EMISOR', 40, boxY + 5, { width: 260, align: 'center' });
            doc.fillColor(primaryColor).fontSize(8);
            doc.font('Helvetica-Bold').text(dte.emisor.nombre, 45, boxY + 20, { width: 250 });
            doc.font('Helvetica-Bold').text('NIT:', 45, boxY + 40); doc.font('Helvetica').text(dte.emisor.nit, 65, boxY + 40);
            doc.font('Helvetica-Bold').text('NRC:', 180, boxY + 40); doc.font('Helvetica').text(dte.emisor.nrc, 205, boxY + 40);
            doc.font('Helvetica-Bold').text('Actividad:', 45, boxY + 52);
            doc.font('Helvetica').text(dte.emisor.descActividad, 45, boxY + 62, { width: 250 });
            doc.font('Helvetica-Bold').text('Dirección:', 45, boxY + 82);
            doc.font('Helvetica').text(dte.emisor.direccion.complemento, 45, boxY + 92, { width: 250 });

            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(9).text('RECEPTOR', 310, boxY + 5, { width: 260, align: 'center' });
            doc.fillColor(primaryColor).fontSize(8);
            doc.font('Helvetica-Bold').text('Nombre:', 315, boxY + 20);
            doc.font('Helvetica').text(dte.receptor.nombre, 360, boxY + 20, { width: 200 });
            doc.font('Helvetica-Bold').text('Tipo Doc:', 315, boxY + 40);
            doc.font('Helvetica').text(dte.identificacion.tipoDte === '01' ? 'DUI' : 'NRC/NIT', 360, boxY + 40);
            doc.font('Helvetica-Bold').text('No. Doc:', 315, boxY + 52);
            doc.font('Helvetica').text(dte.receptor.numDocumento || 'N/A', 360, boxY + 52);
            doc.font('Helvetica-Bold').text('Correo:', 315, boxY + 64);
            doc.font('Helvetica').text(dte.receptor.correo || 'N/A', 360, boxY + 64, { width: 200 });
            doc.font('Helvetica-Bold').text('Teléfono:', 315, boxY + 76);
            doc.font('Helvetica').text(dte.receptor.telefono || 'N/A', 360, boxY + 76);

            // ─── TABLA DE PRODUCTOS ───
            let y = boxY + boxHeight + 15;
            doc.rect(40, y, 530, 20).fill(accentColor);
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
            doc.text('No.', 45, y + 6);
            doc.text('Cant', 65, y + 6);
            doc.text('Unidad', 95, y + 6);
            doc.text('Código', 135, y + 6);
            doc.text('Descripción', 210, y + 6);
            doc.text('P. Unit.', 400, y + 6, { width: 50, align: 'right' });
            doc.text('Venta Gravada', 480, y + 6, { width: 80, align: 'right' });

            y += 20;
            doc.fillColor(primaryColor).font('Helvetica').fontSize(8);

            dte.cuerpoDocumento.forEach((item, index) => {
                const descHeight = doc.heightOfString(item.descripcion, { width: 180 });
                const rowHeight = Math.max(18, descHeight + 6);
                if (index % 2 !== 0) doc.rect(40, y, 530, rowHeight).fill(lightBg);
                doc.fillColor(primaryColor);
                doc.text(item.numItem, 45, y + 5);
                doc.text(item.cantidad, 65, y + 5);
                doc.text('Unidad', 95, y + 5);
                doc.text(item.codigo, 135, y + 5);
                doc.text(item.descripcion, 210, y + 5, { width: 180 });
                const precioReal = (item.precioUni + (item.ivaItem/item.cantidad));
                doc.text(`$${precioReal.toFixed(2)}`, 400, y + 5, { width: 50, align: 'right' });
                doc.text(`$${(item.ventaGravada + item.ivaItem).toFixed(2)}`, 480, y + 5, { width: 80, align: 'right' });
                y += rowHeight;
                if (y > 680) { doc.addPage(); y = 50; }
            });

            // ─── RESUMEN Y TOTALES ───
            y += 15;
            const resX = 360;
            const resValX = 510;
            doc.font('Helvetica').fontSize(8).fillColor(secondaryColor);
            const rows = [
                ['Suma de ventas gravadas:', `$${(dte.resumen.totalGravada + (dte.resumen.tributos?.find(t => t.codigo === "20")?.valor || 0)).toFixed(2)}`],
                ['Suma total de operaciones:', `$${dte.resumen.totalPagar.toFixed(2)}`],
                ['Sub-total:', `$${dte.resumen.totalPagar.toFixed(2)}`],
                ['Monto total de la operación:', `$${dte.resumen.totalPagar.toFixed(2)}`]
            ];
            rows.forEach(row => {
                doc.text(row[0], resX, y);
                doc.font('Helvetica-Bold').fillColor(primaryColor).text(row[1], resValX, y, { align: 'right' });
                doc.moveTo(resX, y + 10).lineTo(570, y + 10).lineWidth(0.2).strokeColor(borderColor).stroke();
                y += 14;
            });
            doc.rect(resX - 5, y + 2, 215, 25).fill(lightBg);
            doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold').text('TOTAL A PAGAR:', resX, y + 10);
            doc.fontSize(14).text(`$${dte.resumen.totalPagar.toFixed(2)}`, resValX, y + 8, { align: 'right' });

            // ─── FOOTER ───
            const footerY = doc.page.height - 100;
            doc.fontSize(7).fillColor(primaryColor).font('Helvetica-Bold').text('VALOR EN LETRAS:', 40, footerY);
            doc.font('Helvetica').text(dte.resumen.totalLetras, 110, footerY);
            doc.end();
        });
    },

    async enviarCorreo(dte, pdfBuffer) {
        if (!dte.receptor.correo) return false;
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.ethereal.email',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
            await transporter.sendMail({
                from: `"${dte.emisor.nombreComercial}" <${dte.emisor.correo}>`,
                to: dte.receptor.correo,
                subject: `DTE - ${dte.identificacion.numeroControl}`,
                text: `Adjunto su documento tributario.`,
                attachments: [{ filename: `${dte.identificacion.codigoGeneracion}.pdf`, content: pdfBuffer }]
            });
            return true;
        } catch (error) { return false; }
    }
};

module.exports = dteUtils;

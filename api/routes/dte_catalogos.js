const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/dte-catalogos/ambientes
router.get('/ambientes', async (req, res) => {
    try {
        const result = await db.query('SELECT codigo, descripcion FROM public.ambiente_destino ORDER BY codigo');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dte-catalogos/modelos
router.get('/modelos', async (req, res) => {
    try {
        const result = await db.query('SELECT codigo, descripcion FROM public.modelo_facturacion ORDER BY codigo');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/dte-catalogos/transmisiones
router.get('/transmisiones', async (req, res) => {
    try {
        const result = await db.query('SELECT codigo, descripcion FROM public.tipo_transmision ORDER BY codigo');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

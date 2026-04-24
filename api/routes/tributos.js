const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/tributos - Obtener todos los tributos (CAT-015)
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT id, codigo, nombre, valor_default, es_porcentaje, es_informativo FROM public.tributos ORDER BY codigo ASC');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener tributos:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

module.exports = router;

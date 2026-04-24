const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/tipo_item - Obtener todos los tipos de ítem (CAT-011)
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT id, codigo, nombre FROM public.tipo_item ORDER BY codigo ASC');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error al obtener tipos de ítem:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

module.exports = router;

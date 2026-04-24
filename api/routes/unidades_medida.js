const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/unidades-medida
 * Retorna el catálogo oficial CAT-014 de unidades de medida
 */
router.get('/', async (req, res) => {
    try {
        const result = await db.pool.query(
            'SELECT id, codigo, nombre FROM public.unidades_medida ORDER BY nombre ASC'
        );
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        console.error('Error al obtener unidades de medida:', err);
        res.status(500).json({
            success: false,
            message: 'Error interno al obtener el catálogo de unidades de medida'
        });
    }
});

module.exports = router;

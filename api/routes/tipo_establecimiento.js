const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @route GET /api/tipo-establecimiento
 * @desc Obtiene todos los tipos de establecimiento (CAT-009)
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.tipo_establecimiento ORDER BY codigo ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener tipos de establecimiento:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

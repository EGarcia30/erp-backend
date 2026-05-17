const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT codigo, nombre FROM public.tipo_impuesto ORDER BY codigo ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error al obtener tipos de impuesto:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;

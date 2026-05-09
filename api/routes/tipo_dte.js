const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @route GET /api/tipo_dte
 * @desc Obtiene todos los tipos de documentos tributarios (CAT-002)
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.tipo_dte ORDER BY codigo ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error al obtener tipos de DTE:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @route GET /api/paises
 * @desc Obtiene todos los países del catálogo CAT-020
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.paises ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener países:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @route GET /api/paises/:codigo
 * @desc Obtiene un país específico por su código de 2 letras
 * @access Public
 */
router.get('/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query('SELECT * FROM public.paises WHERE codigo = $1', [codigo.toUpperCase()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'País no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener país:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @route GET /api/actividad-economica
 * @desc Obtiene todas las actividades económicas del catálogo CAT-019
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.actividad_economica ORDER BY codigo ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener actividades económicas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @route GET /api/actividad-economica/:codigo
 * @desc Obtiene una actividad económica específica por su código de 5 dígitos
 * @access Public
 */
router.get('/:codigo', async (req, res) => {
  const { codigo } = req.params;
  try {
    const result = await pool.query('SELECT * FROM public.actividad_economica WHERE codigo = $1', [codigo]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Actividad económica no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener actividad económica:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

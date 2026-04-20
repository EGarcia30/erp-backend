/**
 * HU7663 ERP SV - Rutas de Departamentos (CAT-012)
 * Ministerio de Hacienda - El Salvador
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

/**
 * GET /api/departamentos
 * Obtener todos los departamentos (CAT-012)
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT codigo, nombre
      FROM departamentos
      WHERE codigo != '00'
      ORDER BY codigo
    `;
    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      catalogo: 'CAT-012'
    });
  } catch (error) {
    console.error('Error al obtener departamentos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener departamentos',
      message: error.message
    });
  }
});

/**
 * GET /api/departamentos/:codigo
 * Obtener un departamento específico
 */
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const query = `
      SELECT codigo, nombre
      FROM departamentos
      WHERE codigo = $1
    `;
    const result = await pool.query(query, [codigo]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Departamento no encontrado',
        catalogo: 'CAT-012'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      catalogo: 'CAT-012'
    });
  } catch (error) {
    console.error('Error al obtener departamento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener departamento',
      message: error.message
    });
  }
});

module.exports = router;

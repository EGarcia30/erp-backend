/**
 * HU7663 ERP SV - Rutas de Municipios/Distritos (CAT-013)
 * Ministerio de Hacienda - El Salvador
 * NOTA: CAT-013 corresponde a DISTRITOS según Ley de Ordenamiento Territorial
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

/**
 * GET /api/municipios
 * Obtener todos los distritos (CAT-013), opcionalmente filtrados por departamento
 * Query params: ?departamento_cod=06
 */
router.get('/', async (req, res) => {
  try {
    const { departamento_cod } = req.query;

    let query = `
      SELECT
        m.codigo,
        m.nombre,
        m.departamento_cod,
        d.nombre as departamento_nombre
      FROM municipios m
      JOIN departamentos d ON m.departamento_cod = d.codigo
    `;
    const params = [];

    if (departamento_cod) {
      query += ' WHERE m.departamento_cod = $1';
      params.push(departamento_cod);
    }

    query += ' ORDER BY m.departamento_cod, m.codigo';

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      catalogo: 'CAT-013',
      filtro: departamento_cod ? { departamento_cod } : null
    });
  } catch (error) {
    console.error('Error al obtener distritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener distritos',
      message: error.message
    });
  }
});

/**
 * GET /api/municipios/:codigo
 * Obtener un distrito específico (requiere departamento en query)
 */
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const { departamento_cod } = req.query;

    if (!departamento_cod) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el parámetro departamento_cod',
        message: 'CAT-013 requiere código de distrito + departamento'
      });
    }

    const query = `
      SELECT
        m.codigo,
        m.nombre,
        m.departamento_cod,
        d.nombre as departamento_nombre
      FROM municipios m
      JOIN departamentos d ON m.departamento_cod = d.codigo
      WHERE m.codigo = $1 AND m.departamento_cod = $2
    `;
    const result = await pool.query(query, [codigo, departamento_cod]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Distrito no encontrado para el departamento especificado',
        catalogo: 'CAT-013'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      catalogo: 'CAT-013'
    });
  } catch (error) {
    console.error('Error al obtener distrito:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener distrito',
      message: error.message
    });
  }
});

/**
 * GET /api/municipios/departamento/:codigo
 * Obtener todos los distritos de un departamento específico
 */
router.get('/departamento/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    // Validar que el departamento existe
    const deptoQuery = 'SELECT 1 FROM departamentos WHERE codigo = $1';
    const deptoResult = await pool.query(deptoQuery, [codigo]);

    if (deptoResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Departamento no encontrado',
        catalogo: 'CAT-012'
      });
    }

    const query = `
      SELECT
        m.codigo,
        m.nombre,
        m.departamento_cod,
        d.nombre as departamento_nombre
      FROM municipios m
      JOIN departamentos d ON m.departamento_cod = d.codigo
      WHERE m.departamento_cod = $1
      ORDER BY m.codigo
    `;

    const result = await pool.query(query, [codigo]);
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      departamento_cod: codigo,
      catalogo: 'CAT-013'
    });
  } catch (error) {
    console.error('Error al obtener distritos del departamento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener distritos del departamento',
      message: error.message
    });
  }
});

module.exports = router;

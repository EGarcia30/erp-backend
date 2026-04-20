const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @route GET /api/clientes
 * @desc Obtiene todos los clientes
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, d.nombre as departamento_nombre, m.nombre as municipio_nombre, 
             a.descripcion as actividad_nombre, p.nombre as pais_nombre, 
             tp.nombre as tipo_persona_nombre, td.nombre as tipo_documento_nombre
      FROM public.clientes c
      LEFT JOIN public.departamentos d ON c.departamento_cod = d.codigo
      LEFT JOIN public.municipios m ON c.municipio_cod = m.codigo AND c.departamento_cod = m.departamento_cod
      LEFT JOIN public.actividad_economica a ON c.cod_actividad = a.codigo
      LEFT JOIN public.paises p ON c.pais_cod = p.codigo
      LEFT JOIN public.tipo_persona tp ON c.tipo_persona = tp.codigo
      LEFT JOIN public.tipo_documento td ON c.tipo_documento = td.codigo
      ORDER BY c.nombre ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener clientes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @route GET /api/clientes/:id
 * @desc Obtiene un cliente por ID
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM public.clientes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener cliente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @route POST /api/clientes
 * @desc Crea un nuevo cliente
 */
router.post('/', async (req, res) => {
  const {
    tipo_documento, num_documento, nrc, nombre, cod_actividad,
    direccion, pais_cod, departamento_cod, municipio_cod, telefono, correo, tipo_persona
  } = req.body;

  try {
    const fechaActual = new Date().toLocaleDateString('sv-SV', { 
            timeZone: 'America/El_Salvador',
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).split('/').reverse().join('-');

    const result = await pool.query(
      `INSERT INTO public.clientes 
      (tipo_documento, num_documento, nrc, nombre, cod_actividad, direccion, pais_cod, departamento_cod, municipio_cod, telefono, correo, tipo_persona, fecha_creado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [tipo_documento || '13', num_documento, nrc, nombre, cod_actividad, direccion, pais_cod || 'SV', departamento_cod, municipio_cod, telefono, correo, tipo_persona || '1', fechaActual]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear cliente:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El número de documento ya está registrado' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @route PUT /api/clientes/:id
 * @desc Actualiza un cliente
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    tipo_documento, num_documento, nrc, nombre, cod_actividad,
    direccion, pais_cod, departamento_cod, municipio_cod, telefono, correo, tipo_persona, activo
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE public.clientes 
      SET tipo_documento = $1, num_documento = $2, nrc = $3, nombre = $4, cod_actividad = $5, 
          direccion = $6, pais_cod = $7, departamento_cod = $8, municipio_cod = $9, telefono = $10, correo = $11, 
          tipo_persona = $12, activo = $13
      WHERE id = $14
      RETURNING *`,
      [tipo_documento, num_documento, nrc, nombre, cod_actividad, direccion, pais_cod, departamento_cod, municipio_cod, telefono, correo, tipo_persona, activo, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar cliente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @route PATCH /api/clientes/:id/toggle
 * @desc Activa/Desactiva un cliente
 */
router.patch('/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  try {
    const result = await pool.query('UPDATE public.clientes SET activo = $1 WHERE id = $2 RETURNING *', [activo, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al cambiar estado cliente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @route GET /api/empresa
 * @desc Obtiene la configuración única de la empresa
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, d.nombre as departamento_nombre, m.nombre as municipio_nombre, 
             a.descripcion as actividad_nombre, p.nombre as pais_nombre,
             te.nombre as establecimiento_nombre, tp.nombre as tipo_persona_nombre,
             td.nombre as tipo_documento_nombre
      FROM public.configuracion_empresa e
      LEFT JOIN public.departamentos d ON e.departamento_cod = d.codigo
      LEFT JOIN public.municipios m ON e.municipio_cod = m.codigo AND e.departamento_cod = m.departamento_cod
      LEFT JOIN public.actividad_economica a ON e.cod_actividad = a.codigo
      LEFT JOIN public.paises p ON e.pais_cod = p.codigo
      LEFT JOIN public.tipo_establecimiento te ON e.tipo_establecimiento = te.codigo
      LEFT JOIN public.tipo_persona tp ON e.tipo_persona = tp.codigo
      LEFT JOIN public.tipo_documento td ON e.tipo_documento = td.codigo
      WHERE e.id = 1
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener datos de empresa:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * @route PUT /api/empresa
 * @desc Actualiza la configuración de la empresa
 */
router.put('/', async (req, res) => {
  const {
    tipo_documento, num_documento, nrc, nombre_legal, nombre_comercial, cod_actividad,
    tipo_establecimiento, telefono, correo, tipo_persona, pais_cod, departamento_cod,
    municipio_cod, direccion, cod_estable_mh, cod_estable, cod_punto_venta_mh, cod_punto_venta, logo_url
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE public.configuracion_empresa 
      SET tipo_documento = $1, num_documento = $2, nrc = $3, nombre_legal = $4, nombre_comercial = $5, 
          cod_actividad = $6, tipo_establecimiento = $7, telefono = $8, correo = $9, tipo_persona = $10, 
          pais_cod = $11, departamento_cod = $12, municipio_cod = $13, direccion = $14, 
          cod_estable_mh = $15, cod_estable = $16, cod_punto_venta_mh = $17, cod_punto_venta = $18, 
          logo_url = $19, fecha_modificado = NOW()
      WHERE id = 1
      RETURNING *`,
      [tipo_documento, num_documento, nrc, nombre_legal, nombre_comercial, cod_actividad,
       tipo_establecimiento, telefono, correo, tipo_persona, pais_cod, departamento_cod,
       municipio_cod, direccion, cod_estable_mh, cod_estable, cod_punto_venta_mh, cod_punto_venta, logo_url]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar datos de empresa:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

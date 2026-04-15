// api/routes/categorias.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ============================================
// RUTAS: CATEGORIAS (INVENTARIO)
// ============================================

// GET /api/categorias - Lista todas las categorías (con filtro opcional por activo)
router.get('/', async (req, res) => {
    try {
        const { activo } = req.query;

        let whereCondition = '1=1';
        if (activo !== undefined) {
            whereCondition = `activo = ${activo === 'true' ? 'true' : 'false'}`;
        }

        const query = `
        SELECT
            id,
            nombre,
            codigo,
            descripcion,
            activo,
            fecha_creado
        FROM public.categorias
        WHERE ${whereCondition}
        ORDER BY nombre ASC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

// POST /api/categorias - Crear nueva categoría
router.post('/', async (req, res) => {
    try {
        const { nombre, codigo, descripcion } = req.body;

        // Validaciones básicas
        if (!nombre || !codigo) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y código son obligatorios'
            });
        }

        // Verificar si el código ya existe
        const checkQuery = 'SELECT id FROM public.categorias WHERE codigo = $1';
        const checkResult = await db.query(checkQuery, [codigo]);

        if (checkResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'El código de categoría ya existe'
            });
        }

        const insertQuery = `
            INSERT INTO public.categorias (nombre, codigo, descripcion, activo)
            VALUES ($1, $2, $3, true)
            RETURNING id, nombre, codigo, descripcion, activo, fecha_creado
        `;

        const result = await db.query(insertQuery, [nombre, codigo, descripcion || null]);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Categoría creada exitosamente'
        });

    } catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

// PATCH /api/categorias/:id - Actualizar categoría
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, codigo, descripcion, activo } = req.body;

        // Verificar si la categoría existe
        const checkQuery = 'SELECT id FROM public.categorias WHERE id = $1';
        const checkResult = await db.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        // Verificar código único (si se está actualizando)
        if (codigo) {
            const codigoCheckQuery = 'SELECT id FROM public.categorias WHERE codigo = $1 AND id != $2';
            const codigoCheckResult = await db.query(codigoCheckQuery, [codigo, id]);

            if (codigoCheckResult.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'El código de categoría ya existe'
                });
            }
        }

        // Construir update dinámico
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (nombre !== undefined) {
            updates.push(`nombre = $${paramIndex}`);
            values.push(nombre);
            paramIndex++;
        }
        if (codigo !== undefined) {
            updates.push(`codigo = $${paramIndex}`);
            values.push(codigo);
            paramIndex++;
        }
        if (descripcion !== undefined) {
            updates.push(`descripcion = $${paramIndex}`);
            values.push(descripcion);
            paramIndex++;
        }
        if (activo !== undefined) {
            updates.push(`activo = $${paramIndex}`);
            values.push(activo);
            paramIndex++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Debe enviar al menos un campo para actualizar'
            });
        }

        values.push(id);

        const updateQuery = `
            UPDATE public.categorias
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING id, nombre, codigo, descripcion, activo, fecha_creado
        `;

        const result = await db.query(updateQuery, values);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Categoría actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

// PATCH /api/categorias/:id/toggle - Activar/Desactivar categoría
router.patch('/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;

        if (typeof activo !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Campo "activo" debe ser boolean (true/false)'
            });
        }

        const toggleQuery = `
            UPDATE public.categorias
            SET activo = $1
            WHERE id = $2
            RETURNING id, nombre, codigo, descripcion, activo, fecha_creado
        `;

        const result = await db.query(toggleQuery, [activo, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: `Categoría ${activo ? 'activada' : 'desactivada'}`
        });

    } catch (error) {
        console.error('Error al toggle categoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

module.exports = router;
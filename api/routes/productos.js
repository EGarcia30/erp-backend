// api/routes/productos.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ============================================
// RUTAS: PRODUCTOS (INVENTARIO)
// ============================================

// GET /api/productos - Lista paginada con FILTRO POR CATEGORÍA (FIX)
router.get('/', async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const categoria = req.query.categoria || 'N/A';
        const search = req.query.search || '';

        let whereConditions = ['p.activo = true'];
        let params = [];
        let paramIndex = 1;

        // FILTRO CATEGORIA
        if (categoria !== 'N/A') {
            whereConditions.push(`c.codigo = $${paramIndex}`);
            params.push(categoria);
            paramIndex++;
        }

        // FILTRO BUSQUEDA
        if (search !== '') {
            whereConditions.push(`(
                p.descripcion ILIKE $${paramIndex}
                OR p.proveedor ILIKE $${paramIndex}
                OR p.presentacion ILIKE $${paramIndex}
                OR c.codigo ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const productosQuery = `
        SELECT 
            p.id, p.descripcion, p.proveedor, p.presentacion,
            p.cantidad_disponible::numeric, p.cantidad_minima::numeric,
            p.cantidad_maxima::numeric, p.precio_compra::numeric, 
            p.precio_venta::numeric, p.precio_venta::numeric as precio_venta_original,
            p.fecha_creado, p.activo, p.tipo_impuesto,
            p.tipo_item_id, p.unidad_medida_id,
            c.codigo as categoria_codigo, 
            c.nombre as categoria_nombre, 
            c.id as categoria_id,
            ti.nombre as tipo_item_nombre,
            um.nombre as unidad_medida_nombre,
            um.codigo as unidad_medida_codigo,
            COALESCE(
                (SELECT json_agg(json_build_object('id', t.id, 'codigo', t.codigo, 'nombre', t.nombre))
                 FROM public.productos_tributarios pt
                 JOIN public.tributos t ON pt.tributo_id = t.id
                 WHERE pt.producto_id = p.id),
                '[]'
            ) as tributos
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        LEFT JOIN public.tipo_item ti ON p.tipo_item_id = ti.id
        LEFT JOIN public.unidades_medida um ON p.unidad_medida_id = um.id
        WHERE ${whereClause}
        ORDER BY p.id DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const countQuery = `
        SELECT COUNT(*) as total
        FROM public.productos p
        LEFT JOIN public.categorias c ON p.categoria_id = c.id
        WHERE ${whereClause}
        `;

        const productosParams = [...params, limit, offset];

        const [productos, countResult] = await Promise.all([
            db.query(productosQuery, productosParams),
            db.query(countQuery, params)
        ]);

        const totalItems = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            success: true,
            data: productos.rows,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                categoria,
                search
            }
        });

    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

// GET /api/productos/all - Lista completa de productos activos sin paginación
router.get('/all', async (req, res) => {
    try {
        const query = `
        SELECT 
            id, 
            descripcion, 
            proveedor, 
            presentacion,
            cantidad_disponible::numeric,
            cantidad_minima::numeric,
            cantidad_maxima::numeric,
            precio_compra::numeric,
            precio_venta::numeric,
            fecha_creado, 
            activo
        FROM public.productos 
        WHERE activo = true
        ORDER BY descripcion ASC`; // Ordenado alfabéticamente para facilitar la búsqueda

        const result = await db.query(query);

        res.json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Error al obtener todos los productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

// 1. TOGGLE ACTIVO/INACTIVO
router.patch('/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;

        // Validar campo activo
        if (typeof activo !== 'boolean') {
            return res.status(400).json({ 
                success: false,
                message: 'Campo "activo" debe ser boolean (true/false)' 
            });
        }

        const toggleQuery = `
            UPDATE public.productos 
            SET activo = $1
            WHERE id = $2
            RETURNING id, descripcion, proveedor, presentacion,
                    cantidad_disponible::numeric, cantidad_minima::numeric, 
                    cantidad_maxima::numeric, precio_compra::numeric, 
                    precio_venta::numeric, fecha_creado, activo
        `;

        const result = await db.query(toggleQuery, [activo, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Producto no encontrado' 
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: `Producto ${activo ? 'activado' : 'desactivado'}`
        });

    } catch (error) {
        console.error('Error al toggle producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor',
            error: error.message
        });
    }
});

// ✅ PATCH /api/productos/:id - ACTUALIZAR con transaccin para tributos
router.patch('/:id', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { id } = req.params;
        const { tributos, ...updates } = req.body;

        await client.query('BEGIN');

        // 1. UPDATE dinámico de campos básicos
        if (Object.keys(updates).length > 0) {
            const setClause = Object.keys(updates)
                .map((key, index) => `${key} = $${index + 1}`)
                .join(', ');
            
            const updateQuery = `UPDATE public.productos SET ${setClause} WHERE id = $${Object.keys(updates).length + 1}`;
            await client.query(updateQuery, [...Object.values(updates), id]);
        }

        // 2. Sincronizar Tributos (si se envían)
        if (tributos && Array.isArray(tributos)) {
            await client.query('DELETE FROM public.productos_tributarios WHERE producto_id = $1', [id]);
            for (const tributo_id of tributos) {
                await client.query(
                    'INSERT INTO public.productos_tributarios (producto_id, tributo_id) VALUES ($1, $2)',
                    [id, tributo_id]
                );
            }
        }

        await client.query('COMMIT');

        // 3. SELECT completo con categoría, campos DTE y tributos
        const selectQuery = `
            SELECT 
                p.id, p.descripcion, p.proveedor, p.presentacion,
                p.cantidad_disponible::numeric, p.cantidad_minima::numeric, 
                p.cantidad_maxima::numeric, p.precio_compra::numeric, 
                p.precio_venta::numeric, p.categoria_id, p.fecha_creado, p.activo,
                p.tipo_item_id, p.unidad_medida_id, p.tipo_impuesto,
                c.codigo as categoria_codigo, c.nombre as categoria_nombre,
                ti.nombre as tipo_item_nombre,
                um.nombre as unidad_medida_nombre,
                um.codigo as unidad_medida_codigo,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', t.id, 'codigo', t.codigo, 'nombre', t.nombre))
                     FROM public.productos_tributarios pt
                     JOIN public.tributos t ON pt.tributo_id = t.id
                     WHERE pt.producto_id = p.id),
                    '[]'
                ) as tributos
            FROM public.productos p
            LEFT JOIN public.categorias c ON p.categoria_id = c.id
            LEFT JOIN public.tipo_item ti ON p.tipo_item_id = ti.id
            LEFT JOIN public.unidades_medida um ON p.unidad_medida_id = um.id
            WHERE p.id = $1
        `;
        
        const productoCompleto = await client.query(selectQuery, [id]);
        
        res.json({ success: true, data: productoCompleto.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor', error: error.message });
    } finally {
        client.release();
    }
});

// ✅ POST /api/productos - CREAR nuevo producto con transaccin para tributos
router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { tributos, ...producto } = req.body;
        
        const fechaLocal = new Date().toLocaleString('sv-SV', {
            timeZone: 'America/El_Salvador',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).split('/').reverse().join('-');

        await client.query('BEGIN');

        // 1. INSERT básico
        const insertQuery = `
            INSERT INTO public.productos (
                descripcion, proveedor, presentacion, 
                cantidad_disponible, cantidad_minima, cantidad_maxima,
                precio_compra, precio_venta, categoria_id, tipo_impuesto, activo, fecha_creado,
                tipo_item_id, unidad_medida_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, COALESCE($12, 1), COALESCE($13, (SELECT id FROM public.unidades_medida WHERE codigo = '59' LIMIT 1)))
            RETURNING id
        `;
        
        const insertValues = [
            producto.descripcion, producto.proveedor, producto.presentacion,
            producto.cantidad_disponible, producto.cantidad_minima, producto.cantidad_maxima,
            producto.precio_compra, producto.precio_venta,
            producto.categoria_id,
            producto.tipo_impuesto || '1',
            fechaLocal,
            producto.tipo_item_id,
            producto.unidad_medida_id
        ];
        
        const insertResult = await client.query(insertQuery, insertValues);
        const newId = insertResult.rows[0].id;

        // 2. Insertar Tributos
        if (tributos && Array.isArray(tributos)) {
            for (const tributo_id of tributos) {
                await client.query(
                    'INSERT INTO public.productos_tributarios (producto_id, tributo_id) VALUES ($1, $2)',
                    [newId, tributo_id]
                );
            }
        }

        await client.query('COMMIT');

        // 3. SELECT completo con categoría, campos DTE y tributos
        const selectQuery = `
            SELECT 
                p.id, p.descripcion, p.proveedor, p.presentacion,
                p.cantidad_disponible::numeric, p.cantidad_minima::numeric, 
                p.cantidad_maxima::numeric, p.precio_compra::numeric, 
                p.precio_venta::numeric, p.categoria_id, p.fecha_creado, p.activo,
                p.tipo_item_id, p.unidad_medida_id, p.tipo_impuesto,
                c.codigo as categoria_codigo, c.nombre as categoria_nombre,
                ti.nombre as tipo_item_nombre,
                um.nombre as unidad_medida_nombre,
                um.codigo as unidad_medida_codigo,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', t.id, 'codigo', t.codigo, 'nombre', t.nombre))
                     FROM public.productos_tributarios pt
                     JOIN public.tributos t ON pt.tributo_id = t.id
                     WHERE pt.producto_id = p.id),
                    '[]'
                ) as tributos
            FROM public.productos p
            LEFT JOIN public.categorias c ON p.categoria_id = c.id
            LEFT JOIN public.tipo_item ti ON p.tipo_item_id = ti.id
            LEFT JOIN public.unidades_medida um ON p.unidad_medida_id = um.id
            WHERE p.id = $1
        `;
        
        const productoCompleto = await client.query(selectQuery, [newId]);
        
        res.json({ success: true, data: productoCompleto.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear producto:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
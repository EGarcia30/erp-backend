# AGENT.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Express.js REST API for a brewery/cervecería ERP system called InventoryPro. It manages inventory, tables (mesas), customer accounts (cuentas), purchases, and sales operations.

## Development Commands

```bash
# Development server with hot reload
npm run dev

# Production server
npm start
```

## Architecture

### Tech Stack
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL (via `pg` library), configured for Supabase or local PostgreSQL
- **Deployment**: Vercel (serverless functions)
- **Authentication**: JWT with bcryptjs for password hashing

### Project Structure

```
api/
├── index.js           # Express app entry point, exports app for Vercel
├── config/
│   └── database.js    # PostgreSQL pool configuration
└── routes/            # Route handlers (one file per domain)
    ├── productos.js
    ├── compras.js
    ├── cuentas.js
    ├── mesas.js
    ├── dashboard.js
    ├── usuarios.js
    ├── promociones.js
    ├── gastosOperativos.js
    ├── categorias.js
    ├── abonos-cuenta.js
    ├── tipo_pago.js
    └── forma_pago.js
```

### Key Patterns

**Database Access**: Uses PostgreSQL pool from `api/config/database.js`:
```javascript
const db = require('../config/database');
const result = await db.query('SELECT * FROM public.table WHERE id = $1', [id]);
```

**Response Format**: All routes follow a consistent response structure:
```javascript
// Success
res.json({ success: true, data: rows });

// With pagination
res.json({
    success: true,
    data: rows,
    pagination: { page, limit, totalItems, totalPages, hasNext, hasPrev }
});

// Error
res.status(500).json({ success: false, error: error.message });
```

**Timezone Handling**: Dates are handled in El Salvador timezone (America/El_Salvador) using JavaScript's `toLocaleDateString`:
```javascript
const fechaLocal = new Date().toLocaleDateString('sv-SV', {
    timeZone: 'America/El_Salvador',
    year: 'numeric', month: '2-digit', day: '2-digit'
}).split('/').reverse().join('-'); // YYYY-MM-DD
```

**Soft Deletes**: Tables use an `activo` boolean column for soft deletes instead of hard deletion.

**Transactions**: For multi-step operations, use PostgreSQL transactions:
```javascript
try {
    await db.query('BEGIN');
    // ... operations
    await db.query('COMMIT');
} catch (error) {
    await db.query('ROLLBACK');
    // ... error handling
}
```

**Query Parameters**: Routes consistently support pagination with `page` and `limit` query params, and many support `search` for text filtering.

### Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - development or production
- `JWT_SECRET` - Secret for JWT signing (defaults to a hardcoded value if not set)

### Database Schema Notes

- Schema uses `public` PostgreSQL schema explicitly
- Tables: `productos`, `mesas`, `cuentas`, `compras`, `compras_detalle`, `usuarios`, `categorias`, `promociones`, `gastos_operativos`, `abonos_cuenta`, `tipo_pago`, `forma_pago`
- Monetary values stored as `numeric` and cast on retrieval
- Date columns use El Salvador local dates stored as timestamps

### Deployment

The app is configured for Vercel serverless deployment via `vercel.json`. The entry point exports the Express app without starting a server, allowing Vercel to handle the HTTP server. Local development checks `require.main === module` to start the server directly.
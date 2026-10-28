/**
 * src/routes/api.js - Rutas RESTful de Restaurante Melidan (PostgreSQL 18)
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { publicUser, userDto, validateUser, dbRoleAliases } = require('../utils/validators');

const router = express.Router();
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
  return rows[0] || null;
}

// ============================================================================
// 1. HEALTHCHECK DE BASE DE DATOS
// ============================================================================
router.get('/health', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT current_database() AS database, version() AS version');
  res.json({ success: true, database: rows[0].database, postgres: rows[0].version });
}));

// ============================================================================
// 2. AUTENTICACIÓN, REGISTRO Y RECUPERACIÓN OTP
// ============================================================================
router.all('/auth', asyncRoute(async (req, res) => {
  const action = String(req.query.action || (req.method === 'POST' ? 'login' : 'users'));
  const input = req.body || {};

  if (action === 'login') {
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado con ese correo electrónico' });
    }
    if (user.is_deleted || user.estado === 'Inactivo') {
      return res.status(403).json({
        success: false,
        message: 'La cuenta de este usuario se encuentra dada de baja o inactiva. Contacte a Gerencia.'
      });
    }

    const stored = String(user.password_hash || '');
    let valid = false;
    try {
      valid = bcrypt.compareSync(password, stored.replace(/^\$2y\$/, '$2a$'));
    } catch (_) {}

    if (!valid) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    const session = publicUser(user);
    session.token = crypto.randomBytes(24).toString('hex');
    return res.json({ success: true, message: 'Inicio de sesión exitoso', user: session });
  }

  if (action === 'register') {
    const v = validateUser(input, false);
    if (!v.is_valid) {
      return res.status(422).json({ success: false, message: 'Falló la validación del registro de usuario', errors: v.errors });
    }
    try {
      const d = v.data;
      const { rows } = await pool.query(
        `INSERT INTO usuarios(nombre, email, password_hash, rol, tipo_documento, numero_documento, nacionalidad, telefono, turno, estado, avatar, is_deleted)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE) RETURNING *`,
        [d.nombre, d.email, d.password_hash, d.rol, d.tipo_documento, d.numero_documento || null, d.nacionalidad, d.telefono || null, d.turno, d.estado, d.avatar]
      );
      const session = publicUser(rows[0]);
      session.token = crypto.randomBytes(24).toString('hex');
      return res.status(201).json({ success: true, message: '¡Cuenta registrada con éxito en Melidan!', user: session });
    } catch (e) {
      if (e.code === '23505') {
        return res.status(409).json({ success: false, message: 'El correo electrónico ya se encuentra registrado' });
      }
      throw e;
    }
  }

  if (action === 'request_reset') {
    const email = String(input.email || '').trim().toLowerCase();
    const u = await getUserByEmail(email);
    if (!u) {
      return res.status(404).json({ success: false, message: 'No existe ninguna cuenta asociada a este correo' });
    }
    const code = String(crypto.randomInt(100000, 1000000));
    await pool.query(
      `INSERT INTO recuperacion_claves(id_usuario, codigo, expira_en, usado)
       VALUES($1, $2, CURRENT_TIMESTAMP + INTERVAL '15 minutes', FALSE)`,
      [u.id_usuario, code]
    );
    return res.json({ success: true, message: 'Código de recuperación generado y guardado en PostgreSQL.', email, code });
  }

  if (action === 'verify_code') {
    const { rows } = await pool.query(
      `SELECT r.id
       FROM recuperacion_claves r
       JOIN usuarios u ON r.id_usuario = u.id_usuario
       WHERE LOWER(u.email) = LOWER($1) AND r.codigo = $2 AND r.usado = FALSE AND r.expira_en > CURRENT_TIMESTAMP
       ORDER BY r.id DESC LIMIT 1`,
      [String(input.email || '').trim(), String(input.code || '').replace(/\D/g, '')]
    );
    if (!rows[0]) {
      return res.status(400).json({ success: false, message: 'El código de 6 dígitos es inválido o ya ha expirado' });
    }
    return res.json({ success: true, message: 'Código verificado correctamente' });
  }

  if (action === 'reset_password') {
    const password = String(input.password || '');
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT r.id, u.id_usuario
         FROM recuperacion_claves r
         JOIN usuarios u ON r.id_usuario = u.id_usuario
         WHERE LOWER(u.email) = LOWER($1) AND r.codigo = $2 AND r.usado = FALSE AND r.expira_en > CURRENT_TIMESTAMP
         ORDER BY r.id DESC LIMIT 1`,
        [String(input.email || '').trim(), String(input.code || '').replace(/\D/g, '')]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Código inválido o expirado' });
      }
      const hash = bcrypt.hashSync(password, 12);
      await client.query('UPDATE usuarios SET password_hash = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_usuario = $2', [hash, rows[0].id_usuario]);
      await client.query('UPDATE recuperacion_claves SET usado = TRUE WHERE id = $1', [rows[0].id]);
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  return res.status(400).json({ success: false, message: 'Acción no válida' });
}));

// ============================================================================
// 3. GESTIÓN DE PERSONAL Y USUARIOS (CRUD + SOFT DELETE)
// ============================================================================
router.get('/staff', asyncRoute(async (req, res) => {
  const { include_deleted, search = '', role = '', status = '' } = req.query;
  const cond = [];
  const params = [];

  if (!['1', 'true', 'yes'].includes(String(include_deleted))) {
    cond.push('(is_deleted = FALSE OR is_deleted IS NULL)');
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    cond.push(`(LOWER(nombre) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR COALESCE(numero_documento,'') LIKE $${params.length} OR LOWER(COALESCE(nacionalidad,'')) LIKE $${params.length})`);
  }
  if (role && role !== 'Todos' && role !== 'todos') {
    const mappedRole = dbRoleAliases[String(role).toLowerCase().trim()] || String(role).toLowerCase().trim();
    params.push(mappedRole);
    cond.push(`rol = $${params.length}`);
  }
  if (status && status !== 'Todos' && status !== 'todos') {
    params.push(status);
    cond.push(`estado = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM usuarios ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY id_usuario`,
    params
  );
  const staff = rows.map(userDto);
  res.json({ success: true, count: staff.length, staff });
}));

router.get('/staff/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id_usuario = $1', [Number(req.params.id)]);
  if (!rows[0]) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  res.json({ success: true, user: userDto(rows[0]) });
}));

router.post('/staff', asyncRoute(async (req, res) => {
  const v = validateUser(req.body || {}, false);
  if (!v.is_valid) {
    return res.status(422).json({ success: false, message: 'Falló la validación de datos del usuario', errors: v.errors });
  }
  const d = v.data;
  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios(nombre, email, password_hash, rol, tipo_documento, numero_documento, nacionalidad, telefono, turno, estado, avatar, is_deleted)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE) RETURNING *`,
      [d.nombre, d.email, d.password_hash, d.rol, d.tipo_documento, d.numero_documento || null, d.nacionalidad, d.telefono || null, d.turno, d.estado, d.avatar]
    );
    const u = userDto(rows[0]);
    res.status(201).json({ success: true, message: 'Usuario registrado exitosamente en la base de datos', member: u, user: u });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ya existe un usuario registrado con ese correo o documento' });
    }
    throw e;
  }
}));

router.put('/staff/:id', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const existingRes = await pool.query('SELECT * FROM usuarios WHERE id_usuario = $1', [id]);
  if (!existingRes.rows[0]) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  const v = validateUser(req.body || {}, true, existingRes.rows[0]);
  if (!v.is_valid) {
    return res.status(422).json({ success: false, message: 'Errores de validación en los datos enviados', errors: v.errors });
  }

  const d = v.data;
  const fields = [];
  const params = [id];
  const allowedCols = ['nombre', 'email', 'rol', 'tipo_documento', 'numero_documento', 'nacionalidad', 'telefono', 'turno', 'estado', 'avatar', 'password_hash'];

  for (const f of allowedCols) {
    if (Object.prototype.hasOwnProperty.call(d, f)) {
      params.push(d[f]);
      fields.push(`${f} = $${params.length}`);
    }
  }

  if (!fields.length) {
    return res.json({ success: true, member: userDto(existingRes.rows[0]), user: userDto(existingRes.rows[0]) });
  }

  fields.push('fecha_actualizacion = CURRENT_TIMESTAMP');
  try {
    const { rows } = await pool.query(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id_usuario = $1 RETURNING *`,
      params
    );
    res.json({ success: true, message: 'Usuario actualizado correctamente', member: userDto(rows[0]), user: userDto(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ese correo electrónico ya pertenece a otro usuario' });
    }
    throw e;
  }
}));

router.delete('/staff/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET is_deleted = TRUE, estado = 'Inactivo', fecha_eliminacion = CURRENT_TIMESTAMP, fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE id_usuario = $1 RETURNING *`,
    [Number(req.params.id)]
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  res.json({ success: true, message: `Usuario #${req.params.id} archivado (Soft Delete).`, member: userDto(rows[0]) });
}));

router.post('/staff/:id/restore', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET is_deleted = FALSE, estado = 'Activo', fecha_eliminacion = NULL, fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE id_usuario = $1 RETURNING *`,
    [Number(req.params.id)]
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  res.json({ success: true, message: 'Usuario restaurado correctamente', member: userDto(rows[0]) });
}));

// ============================================================================
// 4. PRODUCTOS Y CATEGORÍAS
// ============================================================================
router.get('/products', asyncRoute(async (req, res) => {
  const [cats, products] = await Promise.all([
    pool.query('SELECT id_categoria, nombre, descripcion FROM categorias ORDER BY id_categoria'),
    pool.query(
      `SELECT p.id_producto AS id, p.id_categoria, c.nombre AS categoria_nombre,
              p.nombre AS name, p.descripcion AS description, p.precio AS price,
              p.tipo_coccion, p.tiempo_preparacion_min, p.destacado_menu, p.disponible,
              p.imagen_url AS image
       FROM productos p
       LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
       WHERE p.disponible = TRUE
       ORDER BY p.id_categoria, p.id_producto`
    )
  ]);
  res.json({ success: true, categorias: cats.rows, productos: products.rows });
}));

// ============================================================================
// 5. CONTROL DE MESAS Y AFORO (15 MESAS EN TIEMPO REAL)
// ============================================================================
router.get('/mesas', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id_mesa, numero_mesa, codigo_qr, capacidad, estado, tiempo_min, mozo_asignado, monto_acumulado, is_deleted
     FROM mesas WHERE is_deleted = FALSE ORDER BY numero_mesa`
  );
  const counts = { total: rows.length, libre: 0, ocupada: 0, por_limpiar: 0, cuenta: 0 };
  for (const m of rows) {
    if (m.estado === 'disponible') m.estado = 'libre';
    if (counts[m.estado] !== undefined) counts[m.estado]++;
  }
  res.json({ success: true, counts, data: rows });
}));

router.put('/mesas', asyncRoute(async (req, res) => {
  const d = req.body || {};
  const id = Number(d.numero_mesa ?? d.id_mesa);
  const estado = String(d.estado || '').toLowerCase().trim();

  if (!id || !['libre', 'ocupada', 'por_limpiar', 'cuenta', 'disponible'].includes(estado)) {
    return res.status(422).json({ success: false, message: 'Datos o estado de mesa inválidos' });
  }

  const e = estado === 'disponible' ? 'libre' : estado;
  const isReset = e === 'libre' || e === 'por_limpiar';
  const tiempo = e === 'libre' ? 0 : Number(d.tiempo_min ?? 0);

  let queryResult;
  if (isReset) {
    queryResult = await pool.query(
      `UPDATE mesas
       SET estado = $1, tiempo_min = 0, mozo_asignado = '-', monto_acumulado = 0
       WHERE numero_mesa = $2 OR id_mesa = $2
       RETURNING numero_mesa, estado, tiempo_min, mozo_asignado, monto_acumulado`,
      [e, id]
    );
  } else {
    const mozo = d.mozo_asignado !== undefined ? String(d.mozo_asignado) : null;
    const monto = d.monto_acumulado !== undefined ? Number(d.monto_acumulado) : null;
    queryResult = await pool.query(
      `UPDATE mesas
       SET estado = $1,
           tiempo_min = $2,
           mozo_asignado = COALESCE($3, mozo_asignado),
           monto_acumulado = COALESCE($4, monto_acumulado)
       WHERE numero_mesa = $5 OR id_mesa = $5
       RETURNING numero_mesa, estado, tiempo_min, mozo_asignado, monto_acumulado`,
      [e, tiempo, mozo, monto, id]
    );
  }

  if (!queryResult.rowCount) {
    return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
  }
  res.json({ success: true, message: `Mesa ${id} actualizada correctamente`, mesa: queryResult.rows[0] });
}));

// ============================================================================
// 6. PEDIDOS Y COCINA KDS
// ============================================================================
router.get('/orders', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id_pedido, p.numero_comanda, p.id_mesa, m.numero_mesa, m.estado AS estado_mesa,
            p.id_usuario, p.nombre_cliente,
            COALESCE(u.nombre, 'Mozo de Turno') AS mozo_nombre,
            COALESCE((SELECT SUM(dp.cantidad * dp.precio_unitario) FROM detalle_pedidos dp WHERE dp.id_pedido = p.id_pedido), 0) AS total,
            EXISTS(SELECT 1 FROM ventas v WHERE v.id_pedido = p.id_pedido AND v.estado_pago = 'exitoso') AS pagado,
            p.estado, p.fecha_hora,
            TO_CHAR(p.fecha_hora, 'HH12:MI AM') AS hora_formato,
            GREATEST(1, ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.fecha_hora)) / 60))::int AS minutos_transcurridos
     FROM pedidos p
     LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
     LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
     ORDER BY p.id_pedido DESC`
  );

  if (rows.length > 0) {
    const orderIds = rows.map((o) => o.id_pedido);
    const itemsRes = await pool.query(
      `SELECT d.id_detalle, d.id_pedido, d.id_producto, pr.nombre AS nombre_plato,
              d.cantidad, d.precio_unitario, d.observaciones, pr.tipo_coccion, pr.id_categoria,
              CASE
                WHEN pr.id_categoria = 3 THEN 'Bar y Bebidas'
                WHEN pr.tipo_coccion = 'horno_artesanal' THEN 'Horno Artesanal'
                WHEN pr.tipo_coccion = 'fuego_lento' THEN 'Horno / Fuego Lento'
                ELSE 'Estación Wok'
              END AS estacion,
              pr.tiempo_preparacion_min
       FROM detalle_pedidos d
       LEFT JOIN productos pr ON d.id_producto = pr.id_producto
       WHERE d.id_pedido = ANY($1::int[])
       ORDER BY d.id_detalle`,
      [orderIds]
    );

    const byOrder = new Map();
    for (const item of itemsRes.rows) {
      if (!byOrder.has(item.id_pedido)) byOrder.set(item.id_pedido, []);
      byOrder.get(item.id_pedido).push(item);
    }

    for (const o of rows) {
      o.items = byOrder.get(o.id_pedido) || [];
      o.estaciones = [...new Set(o.items.map((i) => i.estacion).filter(Boolean))];
    }
  }

  res.json({ success: true, count: rows.length, orders: rows });
}));

router.post('/orders', asyncRoute(async (req, res) => {
  const d = req.body || {};
  const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) {
    return res.status(400).json({ success: false, message: 'El pedido debe contener al menos un producto' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tableNum = Number(d.table_num ?? d.numero_mesa);
    const tr = await client.query('SELECT id_mesa FROM mesas WHERE numero_mesa = $1 LIMIT 1', [tableNum]);
    if (!tr.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    let waiterId = Number(d.id_usuario) || null;
    if (!waiterId && d.waiter_name) {
      const wr = await client.query(
        `SELECT id_usuario FROM usuarios WHERE LOWER(nombre) LIKE LOWER($1) AND is_deleted = FALSE LIMIT 1`,
        [`%${String(d.waiter_name).trim()}%`]
      );
      waiterId = wr.rows[0]?.id_usuario || null;
    }

    const cr = await client.query('SELECT COALESCE(MAX(numero_comanda), 1050) + 1 AS next FROM pedidos');
    const comanda = Number(cr.rows[0].next);

    const order = await client.query(
      `INSERT INTO pedidos(numero_comanda, id_mesa, id_usuario, nombre_cliente, estado)
       VALUES($1, $2, $3, $4, 'pendiente') RETURNING id_pedido, numero_comanda, estado`,
      [comanda, tr.rows[0].id_mesa, waiterId, String(d.client_name || 'Comensal')]
    );

    let total = 0;
    for (const item of items) {
      const pid = Number(item.id_producto ?? item.id);
      const qty = Number(item.cantidad ?? item.quantity ?? item.qty);
      const pr = await client.query('SELECT precio FROM productos WHERE id_producto = $1 AND disponible = TRUE', [pid]);
      if (!pr.rows[0] || !Number.isInteger(qty) || qty <= 0) {
        throw new Error(`Producto o cantidad inválida: ${pid}`);
      }
      const price = Number(pr.rows[0].precio);
      total += price * qty;
      await client.query(
        'INSERT INTO detalle_pedidos(id_pedido, id_producto, cantidad, precio_unitario, observaciones) VALUES($1,$2,$3,$4,$5)',
        [order.rows[0].id_pedido, pid, qty, price, item.observaciones ?? item.notes ?? '']
      );
    }

    const waiterLabel = String(d.waiter_name || '').trim() || null;
    await client.query(
      `UPDATE mesas
       SET estado = 'ocupada',
           tiempo_min = 15,
           mozo_asignado = COALESCE((SELECT nombre FROM usuarios WHERE id_usuario = $1), $2, mozo_asignado),
           monto_acumulado = $3
       WHERE id_mesa = $4`,
      [waiterId, waiterLabel, total, tr.rows[0].id_mesa]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Comanda creada con éxito en PostgreSQL', order: { ...order.rows[0], total } });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

router.patch('/orders/:id/status', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const raw = String(req.body?.estado ?? req.body?.status ?? '').toLowerCase().trim();
  const map = {
    nuevos: 'pendiente',
    pendiente: 'pendiente',
    cocinando: 'en_cocina',
    en_cocina: 'en_cocina',
    listos: 'listo',
    listo: 'listo',
    entregado: 'entregado',
    cancelado: 'cancelado'
  };

  if (!map[raw]) {
    return res.status(422).json({ success: false, message: `Estado '${raw}' no válido` });
  }

  let q = await pool.query('UPDATE pedidos SET estado = $1 WHERE id_pedido = $2 RETURNING id_pedido, numero_comanda, estado', [map[raw], id]);
  if (!q.rows[0]) {
    q = await pool.query('UPDATE pedidos SET estado = $1 WHERE numero_comanda = $2 RETURNING id_pedido, numero_comanda, estado', [map[raw], id]);
  }
  if (!q.rows[0]) {
    return res.status(404).json({ success: false, message: 'Comanda no encontrada en la base de datos' });
  }
  res.json({ success: true, message: 'Estado de comanda actualizado en PostgreSQL', order: q.rows[0] });
}));

// ============================================================================
// 7. DASHBOARD EJECUTIVO
// ============================================================================
router.get('/dashboard', asyncRoute(async (req, res) => {
  const [sales, active, tables, staffStats, monitor, info] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(monto_total), 0) AS total FROM ventas WHERE estado_pago = 'exitoso' AND fecha_pago::date = CURRENT_DATE`),
    pool.query(`SELECT COUNT(*) AS total FROM pedidos WHERE estado IN ('pendiente', 'en_cocina', 'listo')`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE estado IN ('ocupada', 'cuenta')) AS ocupadas, COUNT(*) AS total FROM mesas WHERE is_deleted = FALSE`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE (is_deleted = FALSE OR is_deleted IS NULL) AND estado = 'Activo') AS activos,
                       COUNT(*) FILTER (WHERE (is_deleted = FALSE OR is_deleted IS NULL) AND LOWER(COALESCE(nacionalidad, 'peruana')) NOT IN ('peruana', 'peru', 'perú')) AS extranjeros
                FROM usuarios`),
    pool.query(
      `SELECT p.id_pedido, p.numero_comanda, m.numero_mesa,
              COALESCE(u.nombre, 'Mozo de Turno') AS mozo_nombre, p.nombre_cliente,
              COALESCE((SELECT SUM(dp.cantidad * dp.precio_unitario) FROM detalle_pedidos dp WHERE dp.id_pedido = p.id_pedido), 0) AS total,
              p.estado,
              CASE
                WHEN p.estado = 'listo' THEN 'Listo para entregar'
                WHEN p.estado = 'en_cocina' THEN 'En cocina'
                WHEN p.estado = 'pendiente' THEN 'Pendiente'
                ELSE p.estado::text
              END AS badge_text,
              TO_CHAR(p.fecha_hora, 'HH12:MI AM') AS hora
       FROM pedidos p
       LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
       LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
       WHERE p.estado IN ('en_cocina', 'listo', 'pendiente')
       ORDER BY p.id_pedido DESC LIMIT 10`
    ),
    pool.query('SELECT nombre, slogan, ruc, direccion, telefono FROM restaurante_info WHERE id_restaurante = 1')
  ]);

  const v = Number(sales.rows[0].total || 0);
  const o = Number(active.rows[0].total || 0);
  const occ = Number(tables.rows[0].ocupadas || 0);
  const tot = Number(tables.rows[0].total || 0);
  const actStaff = Number(staffStats.rows[0].activos || 0);
  const extStaff = Number(staffStats.rows[0].extranjeros || 0);

  res.json({
    success: true,
    database: 'PostgreSQL 18 (Melidan_db)',
    restaurante: info.rows[0] || {},
    metrics: {
      ventas_hoy: v,
      ventas_hoy_formato: `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pedidos_activos: o,
      mesas_ocupadas: occ,
      total_mesas: tot,
      mesas_texto: `${occ} / ${tot}`,
      personal_activo: actStaff,
      extranjeros_activos: extStaff,
      tiempo_promedio: '14 min'
    },
    salon_monitor: monitor.rows
  });
}));

// ============================================================================
// 8. CAJA, VENTAS Y COMPROBANTES ELECTRÓNICOS
// ============================================================================
router.get('/billing', asyncRoute(async (req, res) => {
  const oid = Number(req.query.id_pedido || 0);
  const cid = Number(req.query.id_comprobante || 0);
  const rest = (await pool.query('SELECT nombre, slogan, ruc, direccion, telefono FROM restaurante_info WHERE id_restaurante = 1')).rows[0] || {};

  const baseSelect = `
    SELECT c.*, v.id_venta, v.id_pedido, v.metodo_pago, v.monto_total, v.estado_pago,
           p.numero_comanda, p.nombre_cliente, m.numero_mesa,
           COALESCE(u.nombre, 'Caja Principal') AS atendido_por,
           TO_CHAR(c.fecha_emision, 'DD/MM/YYYY HH12:MI AM') AS fecha_formato
    FROM comprobantes c
    JOIN ventas v ON c.id_venta = v.id_venta
    JOIN pedidos p ON v.id_pedido = p.id_pedido
    LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
    LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
  `;

  let receipt;
  if (cid) {
    receipt = (await pool.query(`${baseSelect} WHERE c.id_comprobante = $1`, [cid])).rows[0];
  } else if (oid) {
    receipt = (await pool.query(`${baseSelect} WHERE v.id_pedido = $1`, [oid])).rows[0];
  } else {
    receipt = (await pool.query(`${baseSelect} ORDER BY c.id_comprobante DESC LIMIT 1`)).rows[0];
  }

  if (!receipt) {
    if (oid) {
      const order = (await pool.query(
        `SELECT p.id_pedido, p.numero_comanda, p.nombre_cliente, m.numero_mesa,
                COALESCE((SELECT SUM(dp.cantidad * dp.precio_unitario) FROM detalle_pedidos dp WHERE dp.id_pedido = p.id_pedido), 0) AS total
         FROM pedidos p LEFT JOIN mesas m ON p.id_mesa = m.id_mesa WHERE p.id_pedido = $1`,
        [oid]
      )).rows[0];
      if (order) return res.json({ success: true, has_receipt: false, restaurante: rest, order });
    }
    return res.status(404).json({ success: false, message: 'Comprobante no encontrado' });
  }

  receipt.items = (await pool.query(
    `SELECT d.id_detalle, d.cantidad, d.precio_unitario, (d.cantidad * d.precio_unitario) AS subtotal,
            pr.nombre AS nombre_plato, d.observaciones
     FROM detalle_pedidos d
     JOIN productos pr ON d.id_producto = pr.id_producto
     WHERE d.id_pedido = $1 ORDER BY d.id_detalle`,
    [receipt.id_pedido]
  )).rows;

  const total = Number(receipt.monto_total);
  const subtotal = total / 1.18;
  receipt.restaurante = rest;
  receipt.has_receipt = true;
  receipt.desglose = {
    subtotal: subtotal.toFixed(2),
    igv: (total - subtotal).toFixed(2),
    total: total.toFixed(2)
  };
  res.json({ success: true, receipt });
}));

router.post('/billing', asyncRoute(async (req, res) => {
  const oid = Number(req.body?.id_pedido || 0);
  if (!oid) return res.status(400).json({ success: false, message: 'ID de pedido requerido' });

  const payment = ['aplicacion', 'efectivo_caja', 'tarjeta_caja'].includes(req.body?.metodo_pago)
    ? req.body.metodo_pago
    : 'tarjeta_caja';
  const type = ['boleta', 'factura'].includes(req.body?.tipo_comprobante)
    ? req.body.tipo_comprobante
    : 'boleta';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const totalR = await client.query('SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total FROM detalle_pedidos WHERE id_pedido = $1', [oid]);
    const total = Number(totalR.rows[0].total);

    const sale = await client.query(
      `INSERT INTO ventas(id_pedido, metodo_pago, monto_total, estado_pago)
       VALUES($1, $2, $3, 'exitoso')
       ON CONFLICT(id_pedido) DO UPDATE
       SET metodo_pago = EXCLUDED.metodo_pago, monto_total = EXCLUDED.monto_total, estado_pago = 'exitoso', fecha_pago = CURRENT_TIMESTAMP
       RETURNING id_venta`,
      [oid, payment, total]
    );

    const serie = type === 'factura' ? 'F001' : 'B001';
    const seq = await client.query('SELECT COALESCE(MAX(id_comprobante), 1000) + 1 AS next FROM comprobantes');
    const num = `${serie}-${String(seq.rows[0].next).padStart(8, '0')}`;

    const comp = await client.query(
      `INSERT INTO comprobantes(id_venta, tipo_comprobante, numero_comprobante)
       VALUES($1, $2, $3)
       ON CONFLICT(id_venta) DO UPDATE
       SET tipo_comprobante = EXCLUDED.tipo_comprobante, numero_comprobante = EXCLUDED.numero_comprobante, fecha_emision = CURRENT_TIMESTAMP
       RETURNING id_comprobante, numero_comprobante, TO_CHAR(fecha_emision, 'DD/MM/YYYY HH12:MI AM') AS fecha_formato`,
      [sale.rows[0].id_venta, type, num]
    );

    await client.query(
      `UPDATE mesas
       SET estado = 'por_limpiar', tiempo_min = 0, mozo_asignado = '-', monto_acumulado = 0
       WHERE id_mesa = (SELECT id_mesa FROM pedidos WHERE id_pedido = $1)`,
      [oid]
    );
    await client.query(`UPDATE pedidos SET estado = 'entregado' WHERE id_pedido = $1`, [oid]);
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Comprobante emitido con éxito en PostgreSQL',
      id_venta: sale.rows[0].id_venta,
      id_comprobante: comp.rows[0].id_comprobante,
      numero_comprobante: comp.rows[0].numero_comprobante,
      fecha_formato: comp.rows[0].fecha_formato,
      monto_total: total
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

module.exports = router;


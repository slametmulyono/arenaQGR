import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authenticate, authorize, ADMIN, PENGURUS } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit } from '../utils/helpers.js';

const router = Router();
router.use(authenticate, authorize(ADMIN, PENGURUS));

const USER_SELECT = `
  SELECT u.id, u.username, u.name, u.role, u.phone, u.position, u.is_active, u.house_id, u.created_at,
         h.number AS house_number, b.name AS block_name
  FROM users u
  LEFT JOIN houses h ON h.id = u.house_id
  LEFT JOIN blocks b ON b.id = h.block_id`;

/** GET /api/users — daftar user (Super Admin: semua; Pengurus: warga/satpam) */
router.get('/', (req, res) => {
  const { role, q } = req.query;
  let sql = USER_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role === PENGURUS) sql += " AND u.role IN ('warga','satpam')";
  if (role) { sql += ' AND u.role = ?'; params.push(role); }
  if (q) { sql += ' AND (u.name LIKE ? OR u.username LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY u.role, u.name';
  res.json({ users: db.prepare(sql).all(...params) });
});

/** POST /api/users — buat user baru */
router.post('/', authorize(ADMIN), (req, res) => {
  const { username, password, name, role, phone, house_id, position } = req.body || {};
  if (!username || !password || !name || !role)
    throw new HttpError(400, 'Username, password, nama, dan peran wajib diisi.');
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) throw new HttpError(409, 'Username sudah digunakan.');
  const r = db
    .prepare(
      `INSERT INTO users (username, password_hash, name, role, phone, house_id, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(username.trim(), bcrypt.hashSync(password, 10), name, role, phone || null,
      house_id || null, position || null);
  audit({ user: req.user, action: 'CREATE_USER', entity: 'user', entityId: r.lastInsertRowid, details: { username, role }, ip: req.ip });
  res.status(201).json({ id: r.lastInsertRowid });
});

/** PUT /api/users/:id — ubah data user (tanpa password) */
router.put('/:id', authorize(ADMIN), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) throw new HttpError(404, 'User tidak ditemukan.');
  const { name, role, phone, house_id, position, is_active } = req.body || {};
  db.prepare(
    `UPDATE users SET name=?, role=?, phone=?, house_id=?, position=?, is_active=? WHERE id=?`
  ).run(name ?? u.name, role ?? u.role, phone ?? u.phone,
    house_id !== undefined ? house_id || null : u.house_id,
    position ?? u.position, is_active !== undefined ? (is_active ? 1 : 0) : u.is_active, u.id);
  audit({ user: req.user, action: 'UPDATE_USER', entity: 'user', entityId: u.id, details: req.body, ip: req.ip });
  res.json({ ok: true });
});

/** PUT /api/users/:id/reset-password */
router.put('/:id/reset-password', authorize(ADMIN), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) throw new HttpError(404, 'User tidak ditemukan.');
  const { password } = req.body || {};
  if (!password || String(password).length < 6)
    throw new HttpError(400, 'Password minimal 6 karakter.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(password, 10), u.id);
  audit({ user: req.user, action: 'RESET_PASSWORD', entity: 'user', entityId: u.id, ip: req.ip });
  res.json({ ok: true });
});

/** Daftar warga per rumah — dipakai pengurus untuk assign penanggung jawab */
router.get('/staff-options', (req, res) => {
  const users = db
    .prepare(`SELECT id, name, role, position FROM users WHERE is_active=1 AND role IN ('pengurus','satpam','warga') ORDER BY name`)
    .all();
  res.json({ users });
});

export default router;

import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA, SATPAM } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

/* ----------------------------- Blocks ----------------------------- */

router.get('/blocks', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  const blocks = db
    .prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM houses h WHERE h.block_id = b.id) AS house_count
       FROM blocks b ORDER BY b.name`
    )
    .all();
  res.json({ blocks });
});

router.post('/blocks', authorize(ADMIN), (req, res) => {
  const { name, cluster } = req.body || {};
  if (!name) throw new HttpError(400, 'Nama blok wajib diisi.');
  const r = db.prepare('INSERT INTO blocks (name, cluster) VALUES (?, ?)').run(name.trim(), cluster || null);
  audit({ user: req.user, action: 'CREATE_BLOCK', entity: 'block', entityId: r.lastInsertRowid, details: { name }, ip: req.ip });
  res.status(201).json({ id: r.lastInsertRowid });
});

/* ----------------------------- Houses ----------------------------- */

const HOUSE_SELECT = `
  SELECT h.*, b.name AS block_name,
    (SELECT o.name FROM occupants o WHERE o.house_id = h.id AND o.is_active = 1 AND o.relation IN ('pemilik','penyewa') ORDER BY o.id LIMIT 1) AS occupant_name,
    (SELECT o.relation FROM occupants o WHERE o.house_id = h.id AND o.is_active = 1 AND o.relation IN ('pemilik','penyewa') ORDER BY o.id LIMIT 1) AS occupant_relation,
    (SELECT COUNT(*) FROM occupants o WHERE o.house_id = h.id AND o.is_active = 1) AS occupant_count,
    (SELECT COALESCE(SUM(total),0) FROM bills WHERE house_id = h.id AND status IN ('unpaid','overdue')) AS outstanding
  FROM houses h JOIN blocks b ON b.id = h.block_id`;

router.get('/houses', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  const { block, status, q } = req.query;
  let sql = HOUSE_SELECT + ' WHERE 1=1';
  const params = [];
  if (block) { sql += ' AND b.name = ?'; params.push(block); }
  if (status) { sql += ' AND h.status = ?'; params.push(status); }
  if (q) { sql += ' AND (h.number LIKE ? OR b.name LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY b.name, CAST(h.number AS INTEGER)';
  res.json({ houses: db.prepare(sql).all(...params) });
});

router.get('/houses/:id', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  const house = db.prepare(HOUSE_SELECT + ' WHERE h.id = ?').get(req.params.id);
  if (!house) throw new HttpError(404, 'Rumah tidak ditemukan.');
  const occupants = db
    .prepare('SELECT * FROM occupants WHERE house_id = ? ORDER BY is_active DESC, start_date DESC')
    .all(house.id);
  const bills = db
    .prepare('SELECT * FROM bills WHERE house_id = ? ORDER BY period DESC LIMIT 12')
    .all(house.id);
  res.json({ house, occupants, bills });
});

router.post('/houses', authorize(ADMIN), (req, res) => {
  const { block_id, number, house_type, land_area, building_area, status, ipl_rate, kebersihan_rate, keamanan_rate } = req.body || {};
  if (!block_id || !number) throw new HttpError(400, 'Blok dan nomor rumah wajib diisi.');
  const r = db
    .prepare(
      `INSERT INTO houses (block_id, number, house_type, land_area, building_area, status, ipl_rate, kebersihan_rate, keamanan_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(block_id, String(number), house_type || null, land_area || null, building_area || null,
      status || 'kosong', ipl_rate || 0, kebersihan_rate || 0, keamanan_rate || 0);
  audit({ user: req.user, action: 'CREATE_HOUSE', entity: 'house', entityId: r.lastInsertRowid, details: req.body, ip: req.ip });
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/houses/:id', authorize(ADMIN, PENGURUS), (req, res) => {
  const existing = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'Rumah tidak ditemukan.');
  const f = { ...existing, ...req.body };
  db.prepare(
    `UPDATE houses SET block_id=?, number=?, house_type=?, land_area=?, building_area=?, status=?,
       ipl_rate=?, kebersihan_rate=?, keamanan_rate=? WHERE id=?`
  ).run(f.block_id, String(f.number), f.house_type, f.land_area, f.building_area, f.status,
    f.ipl_rate, f.kebersihan_rate, f.keamanan_rate, existing.id);
  audit({ user: req.user, action: 'UPDATE_HOUSE', entity: 'house', entityId: existing.id, details: req.body, ip: req.ip });
  res.json({ ok: true });
});

/* --------------------------- Occupants ---------------------------- */

router.post('/houses/:id/occupants', authorize(ADMIN, PENGURUS), (req, res) => {
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
  if (!house) throw new HttpError(404, 'Rumah tidak ditemukan.');
  const { name, phone, relation, start_date, user_id } = req.body || {};
  if (!name) throw new HttpError(400, 'Nama penghuni wajib diisi.');
  const r = db
    .prepare(
      `INSERT INTO occupants (house_id, user_id, name, phone, relation, start_date)
       VALUES (?, ?, ?, ?, ?, date('now'))`
    )
    .run(house.id, user_id || null, name, phone || null, relation || 'pemilik', );
  audit({ user: req.user, action: 'ADD_OCCUPANT', entity: 'house', entityId: house.id, details: { name, relation }, ip: req.ip });
  res.status(201).json({ id: r.lastInsertRowid });
});

/** Akhiri riwayat penghuni (pindah/kontrak habis) */
router.put('/occupants/:id/end', authorize(ADMIN, PENGURUS), (req, res) => {
  const occ = db.prepare('SELECT * FROM occupants WHERE id = ?').get(req.params.id);
  if (!occ) throw new HttpError(404, 'Penghuni tidak ditemukan.');
  db.prepare(`UPDATE occupants SET is_active = 0, end_date = date('now') WHERE id = ?`).run(occ.id);
  audit({ user: req.user, action: 'END_OCCUPANT', entity: 'occupant', entityId: occ.id, ip: req.ip });
  res.json({ ok: true });
});

export default router;

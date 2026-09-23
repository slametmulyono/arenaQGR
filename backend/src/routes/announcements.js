import { Router } from 'express';
import { db } from '../db.js';
import { bus, TOPICS } from '../events/bus.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA, SATPAM } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

const SELECT = `
  SELECT a.*, u.name AS author_name FROM announcements a
  LEFT JOIN users u ON u.id = a.created_by`;

/** GET /api/announcements — semua peran; warga/satpam hanya yang terpublikasi */
router.get('/', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  let sql = SELECT + ' WHERE 1=1';
  if (req.user.role === WARGA || req.user.role === SATPAM) sql += ' AND a.is_published = 1';
  sql += ' ORDER BY a.published_at DESC, a.id DESC LIMIT 100';
  res.json({ announcements: db.prepare(sql).all() });
});

/** POST /api/announcements — pengurus menerbitkan pengumuman (memicu push notif) */
router.post('/', authorize(ADMIN, PENGURUS), (req, res) => {
  const { title, body, category, is_published } = req.body || {};
  if (!title || !body) throw new HttpError(400, 'Judul dan isi pengumuman wajib diisi.');
  const published = is_published === false || is_published === 'false' ? 0 : 1;
  const r = db
    .prepare(
      `INSERT INTO announcements (title, body, category, is_published, published_at, created_by)
       VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, ?)`
    )
    .run(title, body, category || 'umum', published, published, req.user.id);
  audit({ user: req.user, action: 'CREATE_ANNOUNCEMENT', entity: 'announcement', entityId: r.lastInsertRowid,
    details: { title, published }, ip: req.ip });

  if (published) {
    // Event → worker fan-out notifikasi push ke seluruh warga & satpam
    bus.publish(TOPICS.ANNOUNCEMENT_PUBLISHED, {
      announcement: { id: r.lastInsertRowid, title, body },
    });
  }
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', authorize(ADMIN, PENGURUS), (req, res) => {
  const a = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!a) throw new HttpError(404, 'Pengumuman tidak ditemukan.');
  const { title, body, category, is_published } = req.body || {};
  const published = is_published !== undefined ? (is_published ? 1 : 0) : a.is_published;
  db.prepare(
    `UPDATE announcements SET title=?, body=?, category=?, is_published=?,
       published_at = CASE WHEN ? = 1 AND published_at IS NULL THEN datetime('now') ELSE published_at END
     WHERE id=?`
  ).run(title ?? a.title, body ?? a.body, category ?? a.category, published, published, a.id);

  if (published && !a.is_published) {
    bus.publish(TOPICS.ANNOUNCEMENT_PUBLISHED, {
      announcement: { id: a.id, title: title ?? a.title, body: body ?? a.body },
    });
  }
  audit({ user: req.user, action: 'UPDATE_ANNOUNCEMENT', entity: 'announcement', entityId: a.id, ip: req.ip });
  res.json({ ok: true });
});

router.delete('/:id', authorize(ADMIN, PENGURUS), (req, res) => {
  const a = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!a) throw new HttpError(404, 'Pengumuman tidak ditemukan.');
  db.prepare('DELETE FROM announcements WHERE id = ?').run(a.id);
  audit({ user: req.user, action: 'DELETE_ANNOUNCEMENT', entity: 'announcement', entityId: a.id, ip: req.ip });
  res.json({ ok: true });
});

export default router;

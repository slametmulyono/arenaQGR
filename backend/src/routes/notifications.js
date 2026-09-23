import { Router } from 'express';
import { db } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const WHERE_VISIBLE = `
  WHERE (n.user_id = ? OR (n.user_id IS NULL AND (n.broadcast_role = ? OR n.broadcast_role IS NULL)))`;

/** GET /api/notifications — daftar notifikasi untuk user login */
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT n.*, CASE WHEN n.user_id IS NULL THEN 1 ELSE 0 END AS is_broadcast
       FROM notifications n ${WHERE_VISIBLE}
       ORDER BY n.created_at DESC, n.id DESC LIMIT 100`
    )
    .all(req.user.id, req.user.role);
  const readAllAt = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(`notif_read_all_${req.user.id}`)?.value;
  res.json({
    notifications: rows.map((n) =>
      n.is_broadcast && readAllAt && n.created_at <= readAllAt ? { ...n, is_read: 1 } : n
    ),
  });
});

/** GET /api/notifications/unread-count — untuk badge & polling */
router.get('/unread-count', (req, res) => {
  const readAllAt = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(`notif_read_all_${req.user.id}`)?.value || '1970-01-01 00:00:00';
  const row = db
    .prepare(
      `SELECT COUNT(*) c FROM notifications n ${WHERE_VISIBLE}
       AND (n.is_read = 0 AND NOT (n.user_id IS NULL AND n.created_at <= ?))`
    )
    .get(req.user.id, req.user.role, readAllAt);
  res.json({ unread: row.c });
});

/** PUT /api/notifications/read-all — tandai semua sudah dibaca */
router.put('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  // Broadcast dibaca per-user: simpan penanda waktu "read all"
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = datetime('now')`
  ).run(`notif_read_all_${req.user.id}`);
  res.json({ ok: true });
});

export default router;

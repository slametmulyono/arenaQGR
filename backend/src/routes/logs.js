import { Router } from 'express';
import { db } from '../db.js';
import { bus } from '../events/bus.js';
import { authenticate, authorize, ADMIN, PENGURUS } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

/** GET /api/logs — audit trail aktivitas (Super Admin; pengurus read terbatas) */
router.get('/', authorize(ADMIN, PENGURUS), (req, res) => {
  const { q, limit } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (action LIKE ? OR username LIKE ? OR entity LIKE ? OR details LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 200, 1000));
  res.json({ logs: db.prepare(sql).all(...params) });
});

/** GET /api/logs/events — jejak event bus (demo Event-Driven Architecture) */
router.get('/events', authorize(ADMIN), (req, res) => {
  res.json({ events: [...bus.history].reverse().slice(0, 50) });
});

export default router;

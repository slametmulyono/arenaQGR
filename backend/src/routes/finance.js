import { Router } from 'express';
import dayjs from 'dayjs';
import { db } from '../db.js';
import { bus, TOPICS } from '../events/bus.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit, currentPeriod } from '../utils/helpers.js';
import { uploadFinance } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

const REPORT_SELECT = `
  SELECT f.*, u.name AS created_by_name FROM finance_reports f
  LEFT JOIN users u ON u.id = f.created_by`;

/**
 * GET /api/finance/reports — laporan kas masuk/keluar.
 * Warga hanya melihat yang published (transparansi ringkas).
 */
router.get('/reports', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const { period, type } = req.query;
  let sql = REPORT_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role === WARGA) sql += ' AND f.published = 1';
  if (period) { sql += ' AND f.period = ?'; params.push(period); }
  if (type) { sql += ' AND f.type = ?'; params.push(type); }
  sql += ' ORDER BY f.period DESC, f.created_at DESC';
  const reports = db.prepare(sql).all(...params);

  const income = reports.filter((r) => r.type === 'pemasukan').reduce((s, r) => s + r.amount, 0);
  const expense = reports.filter((r) => r.type === 'pengeluaran').reduce((s, r) => s + r.amount, 0);
  // Kas IPL terkumpul dari pembayaran terverifikasi pada periode terpilih
  const iplCollected = period
    ? db.prepare(`SELECT COALESCE(SUM(total),0) t FROM bills WHERE period=? AND status='paid'`).get(period).t
    : null;
  res.json({ reports, summary: { income, expense, balance: income - expense, iplCollected } });
});

router.get('/periods', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const rows = db.prepare('SELECT DISTINCT period FROM finance_reports ORDER BY period DESC').all();
  const periods = new Set(rows.map((r) => r.period));
  periods.add(currentPeriod());
  res.json({ periods: [...periods].sort().reverse() });
});

/** POST /api/finance/reports — pengurus mencatat/mengunggah laporan kas */
router.post('/reports', authorize(ADMIN, PENGURUS), uploadFinance, (req, res) => {
  const { period, title, type, category, amount, description, published } = req.body || {};
  if (!title || !type || !amount)
    throw new HttpError(400, 'Judul, jenis (pemasukan/pengeluaran), dan nominal wajib diisi.');
  if (!['pemasukan', 'pengeluaran'].includes(type))
    throw new HttpError(400, 'Jenis laporan harus pemasukan atau pengeluaran.');
  const r = db
    .prepare(
      `INSERT INTO finance_reports (period, title, type, category, amount, description, attachment_path, published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      period || currentPeriod(), title, type, category || 'lainnya',
      Number(amount), description || null,
      req.file ? `/uploads/finance/${req.file.filename}` : null,
      published === 'false' || published === false ? 0 : 1,
      req.user.id
    );
  audit({ user: req.user, action: 'CREATE_FINANCE_REPORT', entity: 'finance_report', entityId: r.lastInsertRowid,
    details: { title, type, amount }, ip: req.ip });
  if (r.lastInsertRowid && Number(published !== false)) {
    bus.publish(TOPICS.FINANCE_PUBLISHED, {
      report: { id: r.lastInsertRowid, title, type, amount: Number(amount) },
    });
  }
  res.status(201).json({ id: r.lastInsertRowid });
});

router.delete('/reports/:id', authorize(ADMIN, PENGURUS), (req, res) => {
  const f = db.prepare('SELECT * FROM finance_reports WHERE id = ?').get(req.params.id);
  if (!f) throw new HttpError(404, 'Laporan tidak ditemukan.');
  db.prepare('DELETE FROM finance_reports WHERE id = ?').run(f.id);
  audit({ user: req.user, action: 'DELETE_FINANCE_REPORT', entity: 'finance_report', entityId: f.id, ip: req.ip });
  res.json({ ok: true });
});

/** GET /api/finance/summary — ringkasan transparan 6 bulan untuk warga */
router.get('/summary', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const p = dayjs().subtract(i, 'month').format('YYYY-MM');
    const fin = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN type='pemasukan' THEN amount END),0) income,
                COALESCE(SUM(CASE WHEN type='pengeluaran' THEN amount END),0) expense
         FROM finance_reports WHERE period=? AND published=1`
      )
      .get(p);
    const ipl = db
      .prepare(`SELECT COALESCE(SUM(total),0) t FROM bills WHERE period=? AND status='paid'`)
      .get(p).t;
    months.push({ period: p, income: fin.income + ipl, expense: fin.expense, ipl });
  }
  res.json({ months });
});

export default router;

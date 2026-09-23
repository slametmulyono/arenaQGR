import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit, currentPeriod } from '../utils/helpers.js';
import { issueMonthlyBills } from '../workers/index.js';

const router = Router();
router.use(authenticate);

const BILL_SELECT = `
  SELECT b.*, h.number AS house_number, bl.name AS block_name,
    (SELECT p.id FROM payments p WHERE p.bill_id = b.id AND p.status='verified' ORDER BY p.paid_at DESC LIMIT 1) AS payment_id,
    (SELECT p.method FROM payments p WHERE p.bill_id = b.id AND p.status='verified' ORDER BY p.paid_at DESC LIMIT 1) AS payment_method,
    (SELECT p.channel_label FROM payments p WHERE p.bill_id = b.id AND p.status='verified' ORDER BY p.paid_at DESC LIMIT 1) AS payment_channel,
    (SELECT p.paid_at FROM payments p WHERE p.bill_id = b.id AND p.status='verified' ORDER BY p.paid_at DESC LIMIT 1) AS paid_at
  FROM bills b
  JOIN houses h ON h.id = b.house_id
  JOIN blocks bl ON bl.id = h.block_id`;

/** GET /api/bills — pengurus: semua tagihan; warga: tagihan rumahnya */
router.get('/', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const { period, status, q } = req.query;
  let sql = BILL_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role === WARGA) {
    if (!req.user.house_id) return res.json({ bills: [], summary: null });
    sql += ' AND b.house_id = ?';
    params.push(req.user.house_id);
  }
  if (period) { sql += ' AND b.period = ?'; params.push(period); }
  if (status) { sql += ' AND b.status = ?'; params.push(status); }
  if (q && req.user.role !== WARGA) {
    sql += ' AND (h.number LIKE ? OR bl.name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY b.period DESC, bl.name, CAST(h.number AS INTEGER)';
  const bills = db.prepare(sql).all(...params);

  const summary = bills.reduce(
    (acc, b) => {
      acc.total += b.total;
      if (b.status === 'paid') acc.paid += b.total;
      else if (b.status !== 'void') acc.unpaid += b.total;
      return acc;
    },
    { total: 0, paid: 0, unpaid: 0 }
  );
  res.json({ bills, summary });
});

/** GET /api/bills/periods — daftar periode yang tersedia */
router.get('/periods', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const rows = db.prepare('SELECT DISTINCT period FROM bills ORDER BY period DESC').all();
  res.json({ periods: rows.map((r) => r.period), current: currentPeriod() });
});

/** POST /api/bills/generate — terbitkan tagihan periode berjalan sekarang (demo tombol "tanggal 1") */
router.post('/generate', authorize(ADMIN, PENGURUS), (req, res) => {
  const period = req.body?.period || currentPeriod();
  const created = issueMonthlyBills(period);
  audit({ user: req.user, action: 'GENERATE_BILLS', entity: 'bill', details: { period, created }, ip: req.ip });
  res.json({ created, period });
});

/** GET /api/bills/:id — detail tagihan + riwayat pembayarannya */
router.get('/:id', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const bill = db.prepare(BILL_SELECT + ' WHERE b.id = ?').get(req.params.id);
  if (!bill) throw new HttpError(404, 'Tagihan tidak ditemukan.');
  if (req.user.role === WARGA && bill.house_id !== req.user.house_id)
    throw new HttpError(403, 'Tagihan bukan milik hunian Anda.');
  const payments = db
    .prepare('SELECT * FROM payments WHERE bill_id = ? ORDER BY created_at DESC')
    .all(bill.id);
  res.json({ bill, payments });
});

export default router;

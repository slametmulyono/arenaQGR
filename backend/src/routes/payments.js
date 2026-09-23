import { Router } from 'express';
import { db, tx as txRun } from '../db.js';
import { bus, TOPICS } from '../events/bus.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit, generateVA } from '../utils/helpers.js';
import { settlePayment } from '../workers/index.js';
import { uploadPayment } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

/** Kanal pembayaran yang tersedia (simulasi integrasi payment gateway) */
const CHANNELS = [
  { id: 'va_bca', label: 'Virtual Account BCA', group: 'va', prefix: '8808', fee: 0 },
  { id: 'va_mandiri', label: 'Virtual Account Mandiri', group: 'va', prefix: '8950', fee: 0 },
  { id: 'va_bni', label: 'Virtual Account BNI', group: 'va', prefix: '8810', fee: 0 },
  { id: 'qris', label: 'QRIS (semua e-wallet & m-banking)', group: 'ewallet', prefix: '9301', fee: 0 },
  { id: 'gopay', label: 'GoPay', group: 'ewallet', prefix: '9302', fee: 0 },
  { id: 'ovo', label: 'OVO', group: 'ewallet', prefix: '9303', fee: 0 },
  { id: 'dana', label: 'DANA', group: 'ewallet', prefix: '9304', fee: 0 },
  { id: 'cc', label: 'Kartu Kredit / Debit Online', group: 'card', prefix: '5410', fee: 0 },
  { id: 'manual', label: 'Transfer Manual (verifikasi bendahara)', group: 'manual', prefix: null, fee: 0 },
];

router.get('/channels', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  res.json({ channels: CHANNELS });
});

const PAY_SELECT = `
  SELECT p.*, b.period, b.total AS bill_total, h.number AS house_number, bl.name AS block_name,
         v.name AS verified_by_name, c.name AS created_by_name
  FROM payments p
  JOIN bills b ON b.id = p.bill_id
  JOIN houses h ON h.id = b.house_id
  JOIN blocks bl ON bl.id = h.block_id
  LEFT JOIN users v ON v.id = p.verified_by
  LEFT JOIN users c ON c.id = p.created_by`;

/** GET /api/payments — pengurus: semua; warga: miliknya */
router.get('/', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const { status } = req.query;
  let sql = PAY_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role === WARGA) {
    sql += ' AND p.created_by = ?';
    params.push(req.user.id);
  }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  sql += ' ORDER BY p.created_at DESC LIMIT 200';
  res.json({ payments: db.prepare(sql).all(...params) });
});

/**
 * POST /api/payments — warga membayar tagihan.
 * Kanal VA/e-wallet/kartu → status pending lalu diverifikasi OTOMATIS oleh
 * webhook payment gateway (disimulasikan). Kanal manual → bukti transfer
 * diunggah, diverifikasi bendahara.
 */
router.post('/', authorize(WARGA), (req, res) => {
  const { bill_id, method } = req.body || {};
  const channel = CHANNELS.find((c) => c.id === method);
  if (!channel) throw new HttpError(400, 'Metode pembayaran tidak dikenal.');

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(bill_id);
  if (!bill) throw new HttpError(404, 'Tagihan tidak ditemukan.');
  if (bill.house_id !== req.user.house_id)
    throw new HttpError(403, 'Tagihan bukan milik hunian Anda.');
  if (bill.status === 'paid') throw new HttpError(400, 'Tagihan ini sudah lunas.');
  if (bill.status === 'void') throw new HttpError(400, 'Tagihan ini dibatalkan.');

  const pending = db
    .prepare(`SELECT id FROM payments WHERE bill_id = ? AND status = 'pending' AND method != 'manual'`)
    .get(bill.id);
  if (pending)
    throw new HttpError(409, 'Masih ada proses pembayaran berjalan untuk tagihan ini. Tunggu verifikasi otomatis.');

  const va = channel.group === 'manual' ? null : generateVA(channel.prefix);
  const r = db
    .prepare(
      `INSERT INTO payments (bill_id, method, channel_label, va_number, amount, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(bill.id, channel.id, channel.label, va, bill.total, req.user.id);

  audit({ user: req.user, action: 'CREATE_PAYMENT', entity: 'payment', entityId: r.lastInsertRowid,
    details: { bill_id, method, amount: bill.total }, ip: req.ip });

  if (channel.group !== 'manual') {
    // Publish event → gateway simulator akan "settle" via webhook otomatis
    bus.publish(TOPICS.PAYMENT_CREATED, { paymentId: r.lastInsertRowid, simulate: true });
  }

  const payment = db.prepare(PAY_SELECT + ' WHERE p.id = ?').get(r.lastInsertRowid);
  res.status(201).json({ payment, autoVerify: channel.group !== 'manual' });
});

/** POST /api/payments/:id/upload-proof — warga mengunggah bukti transfer manual */
router.post('/:id/upload-proof', authorize(WARGA), uploadPayment, (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) throw new HttpError(404, 'Pembayaran tidak ditemukan.');
  if (p.created_by !== req.user.id) throw new HttpError(403, 'Bukan pembayaran Anda.');
  if (p.method !== 'manual') throw new HttpError(400, 'Unggah bukti hanya untuk transfer manual.');
  if (!req.file) throw new HttpError(400, 'File bukti transfer wajib diunggah.');
  const proofPath = `/uploads/payments/${req.file.filename}`;
  db.prepare('UPDATE payments SET proof_path = ?, note = ? WHERE id = ?')
    .run(proofPath, req.body?.note || null, p.id);
  audit({ user: req.user, action: 'UPLOAD_PAYMENT_PROOF', entity: 'payment', entityId: p.id, ip: req.ip });
  res.json({ ok: true, proof_path: proofPath });
});

/** PUT /api/payments/:id/verify — bendahara memverifikasi pembayaran manual */
router.put('/:id/verify', authorize(ADMIN, PENGURUS), (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) throw new HttpError(404, 'Pembayaran tidak ditemukan.');
  if (p.status === 'verified') throw new HttpError(400, 'Pembayaran sudah terverifikasi.');
  const { decision, note } = req.body || {};

  if (decision === 'reject') {
    db.prepare(`UPDATE payments SET status='failed', note=?, verified_by=?, paid_at=datetime('now') WHERE id=?`)
      .run(note || 'Bukti transfer tidak valid', req.user.id, p.id);
    audit({ user: req.user, action: 'REJECT_PAYMENT', entity: 'payment', entityId: p.id, details: { note }, ip: req.ip });
    return res.json({ ok: true, status: 'failed' });
  }

  txRun(() => {
    db.prepare(
      `UPDATE payments SET status='verified', paid_at=datetime('now'), verified_by=?, note=?,
       gateway_ref='MANUAL-' || hex(randomblob(4)) WHERE id=?`
    ).run(req.user.id, note || 'Diverifikasi bendahara', p.id);
    db.prepare(`UPDATE bills SET status='paid' WHERE id=?`).run(p.bill_id);
  });

  bus.publish(TOPICS.PAYMENT_VERIFIED, {
    billId: p.bill_id, amount: p.amount, method: p.method, label: p.channel_label,
  });
  audit({ user: req.user, action: 'VERIFY_PAYMENT', entity: 'payment', entityId: p.id, ip: req.ip });
  res.json({ ok: true, status: 'verified' });
});

/** POST /api/payments/:id/settle — endpoint demo: paksa webhook gateway (dev) */
router.post('/:id/settle', authorize(ADMIN, PENGURUS), (req, res) => {
  settlePayment(Number(req.params.id));
  const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!p) throw new HttpError(404, 'Pembayaran tidak ditemukan.');
  res.json({ payment: p });
});

export default router;

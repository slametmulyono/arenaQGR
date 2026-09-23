import { Router } from 'express';
import QRCode from 'qrcode';
import dayjs from 'dayjs';
import { db } from '../db.js';
import { bus, TOPICS } from '../events/bus.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA, SATPAM } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit, generateToken } from '../utils/helpers.js';
import { uploadGuest } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

const QR_PREFIX = 'QGR-GUEST:';

/* ---------------------- Undangan QR (Warga) ---------------------- */

/** POST /api/guests/invites — warga membuat undangan QR berbatas waktu */
router.post('/invites', authorize(WARGA), async (req, res, next) => {
  try {
    if (!req.user.house_id) throw new HttpError(400, 'Akun Anda belum terhubung ke sebuah rumah.');
    const { guest_name, guest_phone, purpose, vehicle_plate, hours } = req.body || {};
    if (!guest_name) throw new HttpError(400, 'Nama tamu wajib diisi.');
    const durHours = Math.min(Math.max(Number(hours) || 4, 1), 72);
    const validFrom = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const validUntil = dayjs().add(durHours, 'hour').format('YYYY-MM-DD HH:mm:ss');

    const token = generateToken(18);
    const qrImage = await QRCode.toDataURL(`${QR_PREFIX}${token}`, {
      width: 512, margin: 2, color: { dark: '#14532d', light: '#ffffff' },
    });

    const r = db
      .prepare(
        `INSERT INTO guest_invites (house_id, created_by, guest_name, guest_phone, purpose, vehicle_plate, valid_from, valid_until, token, qr_image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.house_id, req.user.id, guest_name, guest_phone || null, purpose || 'Bertamu',
        vehicle_plate || null, validFrom, validUntil, token, qrImage);

    audit({ user: req.user, action: 'CREATE_GUEST_INVITE', entity: 'guest_invite', entityId: r.lastInsertRowid,
      details: { guest_name, validUntil }, ip: req.ip });

    const invite = db.prepare('SELECT * FROM guest_invites WHERE id = ?').get(r.lastInsertRowid);
    res.status(201).json({ invite });
  } catch (err) { next(err); }
});

const INVITE_SELECT = `
  SELECT gi.*, h.number AS house_number, b.name AS block_name, u.name AS host_name
  FROM guest_invites gi
  JOIN houses h ON h.id = gi.house_id
  JOIN blocks b ON b.id = h.block_id
  JOIN users u ON u.id = gi.created_by`;

/** GET /api/guests/invites — warga: miliknya; satpam/pengurus: semua aktif */
router.get('/invites', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  let sql = INVITE_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role === WARGA) { sql += ' AND gi.created_by = ?'; params.push(req.user.id); }
  if (req.query.active === 'true')
    sql += " AND gi.status='active' AND gi.valid_until >= datetime('now')";
  sql += ' ORDER BY gi.created_at DESC LIMIT 100';
  const invites = db.prepare(sql).all(...params);
  // Jangan bocorkan token/QR ke peran selain pemilik & satpam
  res.json({
    invites: invites.map((i) =>
      req.user.role === WARGA && i.created_by !== req.user.id
        ? { ...i, token: undefined, qr_image: undefined }
        : i
    ),
  });
});

/** PUT /api/guests/invites/:id/cancel — warga membatalkan undangan */
router.put('/invites/:id/cancel', authorize(WARGA), (req, res) => {
  const inv = db.prepare('SELECT * FROM guest_invites WHERE id = ?').get(req.params.id);
  if (!inv) throw new HttpError(404, 'Undangan tidak ditemukan.');
  if (inv.created_by !== req.user.id) throw new HttpError(403, 'Bukan undangan Anda.');
  if (inv.status !== 'active') throw new HttpError(400, `Undangan sudah berstatus ${inv.status}.`);
  db.prepare(`UPDATE guest_invites SET status='cancelled' WHERE id=?`).run(inv.id);
  audit({ user: req.user, action: 'CANCEL_GUEST_INVITE', entity: 'guest_invite', entityId: inv.id, ip: req.ip });
  res.json({ ok: true });
});

/* ---------------------- Pos Gerbang (Satpam) ---------------------- */

/**
 * POST /api/guests/scan — satpam memindai QR tamu.
 * Jika tamu belum masuk → catat check-in. Jika masih di dalam → catat check-out.
 */
router.post('/scan', authorize(SATPAM, ADMIN, PENGURUS), (req, res) => {
  let { token } = req.body || {};
  if (!token) throw new HttpError(400, 'Token QR tidak ditemukan.');
  token = String(token).trim().replace(QR_PREFIX, '');

  const inv = db.prepare(INVITE_SELECT + ' WHERE gi.token = ?').get(token);
  if (!inv) throw new HttpError(404, 'QR tidak dikenali. Gunakan buku tamu manual jika perlu.');
  if (inv.status === 'cancelled') throw new HttpError(400, 'Undangan ini telah dibatalkan oleh warga.');

  const now = dayjs();
  if (dayjs(inv.valid_until).isBefore(now) || inv.status === 'expired') {
    db.prepare(`UPDATE guest_invites SET status='expired' WHERE id=? AND status='active'`).run(inv.id);
    throw new HttpError(400, 'QR kedaluwarsa. Minta warga membuat undangan baru.');
  }

  const openVisit = db
    .prepare('SELECT * FROM guest_visits WHERE invite_id = ? AND check_out_at IS NULL')
    .get(inv.id);

  const houseLabel = `Blok ${inv.block_name} No. ${inv.house_number}`;

  if (openVisit) {
    // Check-out
    db.prepare(`UPDATE guest_visits SET check_out_at = datetime('now') WHERE id = ?`).run(openVisit.id);
    db.prepare(`UPDATE guest_invites SET status='used' WHERE id = ?`).run(inv.id);
    const visit = db.prepare('SELECT * FROM guest_visits WHERE id = ?').get(openVisit.id);
    bus.publish(TOPICS.GUEST_CHECKOUT, { visit: { ...visit, house_id: inv.house_id } });
    audit({ user: req.user, action: 'GUEST_CHECKOUT', entity: 'guest_visit', entityId: visit.id,
      details: { guest: inv.guest_name, house: houseLabel }, ip: req.ip });
    return res.json({
      result: 'checkout', houseLabel,
      visit: { ...visit, house_label: houseLabel, guest_name: inv.guest_name, purpose: inv.purpose },
    });
  }

  // Check-in
  const r = db
    .prepare(
      `INSERT INTO guest_visits (invite_id, house_id, guest_name, guest_phone, purpose, vehicle_plate, method, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, 'qr', ?)`
    )
    .run(inv.id, inv.house_id, inv.guest_name, inv.guest_phone, inv.purpose, inv.vehicle_plate, req.user.id);
  const visit = db.prepare('SELECT * FROM guest_visits WHERE id = ?').get(r.lastInsertRowid);
  bus.publish(TOPICS.GUEST_CHECKIN, { visit: { ...visit, house_id: inv.house_id } });
  audit({ user: req.user, action: 'GUEST_CHECKIN', entity: 'guest_visit', entityId: visit.id,
    details: { guest: inv.guest_name, house: houseLabel }, ip: req.ip });
  res.json({
    result: 'checkin', houseLabel,
    visit: { ...visit, house_label: houseLabel },
  });
});

/** POST /api/guests/visits/manual — buku tamu manual oleh satpam */
router.post('/visits/manual', authorize(SATPAM, ADMIN, PENGURUS), uploadGuest, (req, res) => {
  const { guest_name, guest_phone, purpose, vehicle_plate, house_id, notes } = req.body || {};
  if (!guest_name) throw new HttpError(400, 'Nama tamu wajib diisi.');
  const r = db
    .prepare(
      `INSERT INTO guest_visits (house_id, guest_name, guest_phone, purpose, vehicle_plate, id_photo_path, method, recorded_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
    )
    .run(house_id || null, guest_name, guest_phone || null, purpose || 'Bertamu',
      vehicle_plate || null, req.file ? `/uploads/guests/${req.file.filename}` : null,
      req.user.id, notes || null);
  const visit = db.prepare('SELECT * FROM guest_visits WHERE id = ?').get(r.lastInsertRowid);
  bus.publish(TOPICS.GUEST_CHECKIN, { visit });
  audit({ user: req.user, action: 'GUEST_MANUAL_ENTRY', entity: 'guest_visit', entityId: visit.id,
    details: { guest_name, vehicle_plate }, ip: req.ip });
  res.status(201).json({ visit });
});

const VISIT_SELECT = `
  SELECT gv.*, h.number AS house_number, b.name AS block_name, u.name AS recorder_name
  FROM guest_visits gv
  LEFT JOIN houses h ON h.id = gv.house_id
  LEFT JOIN blocks b ON b.id = h.block_id
  LEFT JOIN users u ON u.id = gv.recorded_by`;

/** GET /api/guests/visits — daftar kunjungan (satpam/pengurus; warga: tamu rumahnya) */
router.get('/visits', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  const { today, inside, q } = req.query;
  let sql = VISIT_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role === WARGA) { sql += ' AND gv.house_id = ?'; params.push(req.user.house_id); }
  if (today === 'true') sql += " AND date(gv.check_in_at) = date('now')";
  if (inside === 'true') sql += ' AND gv.check_out_at IS NULL';
  if (q) { sql += ' AND (gv.guest_name LIKE ? OR gv.vehicle_plate LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY gv.check_in_at DESC LIMIT 200';
  res.json({ visits: db.prepare(sql).all(...params) });
});

/** PUT /api/guests/visits/:id/checkout — satpam mencatat keluar manual */
router.put('/visits/:id/checkout', authorize(SATPAM, ADMIN, PENGURUS), (req, res) => {
  const v = db.prepare('SELECT * FROM guest_visits WHERE id = ?').get(req.params.id);
  if (!v) throw new HttpError(404, 'Kunjungan tidak ditemukan.');
  if (v.check_out_at) throw new HttpError(400, 'Tamu sudah tercatat keluar.');
  db.prepare(`UPDATE guest_visits SET check_out_at = datetime('now') WHERE id = ?`).run(v.id);
  const visit = db.prepare('SELECT * FROM guest_visits WHERE id = ?').get(v.id);
  bus.publish(TOPICS.GUEST_CHECKOUT, { visit });
  audit({ user: req.user, action: 'GUEST_CHECKOUT_MANUAL', entity: 'guest_visit', entityId: v.id, ip: req.ip });
  res.json({ visit });
});

export default router;

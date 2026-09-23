import { Router } from 'express';
import { db } from '../db.js';
import { bus, TOPICS } from '../events/bus.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA, SATPAM } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit, generateComplaintCode } from '../utils/helpers.js';
import { uploadComplaint } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

export const CATEGORIES = [
  'Kebersihan Lingkungan', 'Keamanan & Ketertiban', 'Fasilitas Umum',
  'Jalan & Drainase', 'Penerangan (PJU)', 'Taman & Penghijauan',
  'Gangguan Tetangga', 'Lainnya',
];

const COMPLAINT_SELECT = `
  SELECT c.*, u.name AS reporter_name, u.phone AS reporter_phone,
         h.number AS house_number, b.name AS block_name,
         a.name AS assignee_name
  FROM complaints c
  JOIN users u ON u.id = c.created_by
  LEFT JOIN houses h ON h.id = c.house_id
  LEFT JOIN blocks b ON b.id = h.block_id
  LEFT JOIN users a ON a.id = c.assigned_to`;

router.get('/categories', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  res.json({ categories: CATEGORIES });
});

/** GET /api/complaints — warga: miliknya; staff: semua; satpam: darurat + semua (read) */
router.get('/', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  const { status, q, mine } = req.query;
  let sql = COMPLAINT_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role === WARGA || mine === 'true') {
    sql += ' AND c.created_by = ?'; params.push(req.user.id);
  }
  if (status) { sql += ' AND c.status = ?'; params.push(status); }
  if (q) { sql += ' AND (c.title LIKE ? OR c.code LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY c.created_at DESC LIMIT 200';
  const complaints = db.prepare(sql).all(...params);
  res.json({ complaints });
});

/** POST /api/complaints — warga mengajukan pengaduan (foto + lokasi) */
router.post('/', authorize(WARGA), uploadComplaint, (req, res) => {
  const { category, title, description, location_text, lat, lng, priority } = req.body || {};
  if (!category || !title)
    throw new HttpError(400, 'Kategori dan judul pengaduan wajib diisi.');
  const code = generateComplaintCode();
  const r = db
    .prepare(
      `INSERT INTO complaints (code, house_id, created_by, category, title, description, photo_path, location_text, lat, lng, status, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?)`
    )
    .run(code, req.user.house_id, req.user.id, category, title, description || null,
      req.file ? `/uploads/complaints/${req.file.filename}` : null,
      location_text || null, lat ? Number(lat) : null, lng ? Number(lng) : null,
      ['rendah', 'normal', 'tinggi', 'darurat'].includes(priority) ? priority : 'normal');

  const complaint = db
    .prepare(COMPLAINT_SELECT.replace('SELECT c.*,', 'SELECT c.*,') + ' WHERE c.id = ?')
    .get(r.lastInsertRowid);
  bus.publish(TOPICS.COMPLAINT_CREATED, {
    complaint: { ...complaint, house_label: complaint.block_name ? `Blok ${complaint.block_name} No. ${complaint.house_number}` : null },
  });
  audit({ user: req.user, action: 'CREATE_COMPLAINT', entity: 'complaint', entityId: r.lastInsertRowid,
    details: { code, category, title }, ip: req.ip });
  res.status(201).json({ complaint });
});

/** GET /api/complaints/:id — detail + timeline komentar */
router.get('/:id', authorize(ADMIN, PENGURUS, WARGA, SATPAM), (req, res) => {
  const complaint = db.prepare(COMPLAINT_SELECT + ' WHERE c.id = ?').get(req.params.id);
  if (!complaint) throw new HttpError(404, 'Pengaduan tidak ditemukan.');
  if (req.user.role === WARGA && complaint.created_by !== req.user.id)
    throw new HttpError(403, 'Anda tidak berhak melihat pengaduan ini.');
  const comments = db
    .prepare(
      `SELECT cc.*, u.name AS author_name, u.role AS author_role FROM complaint_comments cc
       JOIN users u ON u.id = cc.user_id WHERE cc.complaint_id = ? ORDER BY cc.created_at ASC`
    )
    .all(complaint.id);
  res.json({ complaint, comments });
});

/**
 * PUT /api/complaints/:id/status — alur kerja resolusi oleh pengurus:
 * menunggu → diproses → selesai (atau ditolak). Termasuk penugasan (assign).
 */
router.put('/:id/status', authorize(ADMIN, PENGURUS), (req, res) => {
  const c = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!c) throw new HttpError(404, 'Pengaduan tidak ditemukan.');
  const { status, assigned_to, message } = req.body || {};
  const allowed = ['draft', 'menunggu', 'diproses', 'selesai', 'ditolak'];
  if (status && !allowed.includes(status))
    throw new HttpError(400, `Status tidak valid. Pilih: ${allowed.join(', ')}.`);

  db.prepare(
    `UPDATE complaints SET status = COALESCE(?, status), assigned_to = COALESCE(?, assigned_to),
       resolved_at = CASE WHEN ? = 'selesai' THEN datetime('now') ELSE resolved_at END,
       updated_at = datetime('now') WHERE id = ?`
  ).run(status || null, assigned_to !== undefined ? assigned_to || null : null, status || null, c.id);

  if (message) {
    db.prepare('INSERT INTO complaint_comments (complaint_id, user_id, message) VALUES (?, ?, ?)')
      .run(c.id, req.user.id, message);
  }

  const updated = db.prepare(COMPLAINT_SELECT + ' WHERE c.id = ?').get(c.id);
  bus.publish(TOPICS.COMPLAINT_UPDATED, {
    complaint: updated,
    message: message || (status ? `Status pengaduan berubah menjadi "${status}".` : undefined),
  });
  if (assigned_to && updated.assignee_name) {
    db.prepare(
      `INSERT INTO notifications (user_id, title, body, type, ref) VALUES (?, ?, ?, 'complaint', ?)`
    ).run(assigned_to, `Anda ditugaskan menangani ${updated.code}`,
      `${updated.title} — ${updated.category}`, `complaint:${updated.id}`);
  }
  audit({ user: req.user, action: 'UPDATE_COMPLAINT_STATUS', entity: 'complaint', entityId: c.id,
    details: { status, assigned_to }, ip: req.ip });
  res.json({ complaint: updated });
});

/** POST /api/complaints/:id/comments — warga/pengurus menambah komentar */
router.post('/:id/comments', authorize(ADMIN, PENGURUS, WARGA), (req, res) => {
  const c = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!c) throw new HttpError(404, 'Pengaduan tidak ditemukan.');
  if (req.user.role === WARGA && c.created_by !== req.user.id)
    throw new HttpError(403, 'Anda tidak berhak mengomentari pengaduan ini.');
  const { message } = req.body || {};
  if (!message) throw new HttpError(400, 'Pesan komentar wajib diisi.');
  const r = db
    .prepare('INSERT INTO complaint_comments (complaint_id, user_id, message) VALUES (?, ?, ?)')
    .run(c.id, req.user.id, message);
  // Beri tahu pihak lainnya
  const target = req.user.role === WARGA ? null : c.created_by;
  if (target) {
    bus.publish(TOPICS.COMPLAINT_UPDATED, {
      complaint: c, message: `Komentar baru dari ${req.user.name}: "${message}"`,
    });
  } else {
    db.prepare(
      `INSERT INTO notifications (broadcast_role, title, body, type, ref) VALUES ('pengurus', ?, ?, 'complaint', ?)`
    ).run(`Komentar warga pada ${c.code}`, message, `complaint:${c.id}`);
  }
  res.status(201).json({ id: r.lastInsertRowid });
});

export default router;

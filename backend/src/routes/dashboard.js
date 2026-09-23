import { Router } from 'express';
import dayjs from 'dayjs';
import { db } from '../db.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA, SATPAM } from '../middleware/auth.js';
import { currentPeriod } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

/** GET /api/dashboard — statistik ringkas sesuai peran */
router.get('/', (req, res) => {
  const role = req.user.role;
  const period = currentPeriod();

  if (role === ADMIN || role === PENGURUS) {
    const houses = db
      .prepare(
        `SELECT COUNT(*) total,
          SUM(status='ditempati') ditempati,
          SUM(status='kosong') kosong,
          SUM(status='perbaikan') perbaikan
         FROM houses`
      )
      .get();
    const residents = db.prepare(`SELECT COUNT(*) c FROM users WHERE role='warga' AND is_active=1`).get().c;
    const billsMonth = db
      .prepare(
        `SELECT COUNT(*) total, SUM(status='paid') paid, SUM(status IN ('unpaid','overdue')) unpaid,
          COALESCE(SUM(CASE WHEN status='paid' THEN total END),0) collected,
          COALESCE(SUM(CASE WHEN status!='paid' THEN total END),0) outstanding,
          COALESCE(SUM(total),0) billed
         FROM bills WHERE period = ?`
      )
      .get(period);
    const complaints = db
      .prepare(
        `SELECT COUNT(*) total,
          SUM(status='menunggu') menunggu,
          SUM(status='diproses') diproses,
          SUM(status='selesai') selesai
         FROM complaints`
      )
      .get();
    const guestsToday = db
      .prepare(`SELECT COUNT(*) c FROM guest_visits WHERE date(check_in_at) = date('now')`).get().c;
    const guestsInside = db
      .prepare(`SELECT COUNT(*) c FROM guest_visits WHERE check_out_at IS NULL`).get().c;
    const activeInvites = db
      .prepare(`SELECT COUNT(*) c FROM guest_invites WHERE status='active' AND valid_until >= datetime('now')`)
      .get().c;

    // Tren 6 bulan: penagihan vs kolektibilitas
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const p = dayjs().subtract(i, 'month').format('YYYY-MM');
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(total),0) billed,
                  COALESCE(SUM(CASE WHEN status='paid' THEN total END),0) collected
           FROM bills WHERE period = ?`
        )
        .get(p);
      trend.push({ period: p, billed: row.billed, collected: row.collected });
    }

    // Komposisi kas bulan ini
    const cash = db
      .prepare(
        `SELECT type, COALESCE(SUM(amount),0) total FROM finance_reports
         WHERE period = ? GROUP BY type`
      )
      .all(period);

    const recentComplaints = db
      .prepare(
        `SELECT c.id, c.code, c.title, c.status, c.priority, c.created_at, u.name AS reporter
         FROM complaints c JOIN users u ON u.id = c.created_by
         ORDER BY c.created_at DESC LIMIT 5`
      )
      .all();

    return res.json({
      role,
      houses,
      residents,
      billsMonth: { ...billsMonth, period },
      complaints,
      guestsToday,
      guestsInside,
      activeInvites,
      trend,
      cash,
      recentComplaints,
    });
  }

  if (role === WARGA) {
    const houseId = req.user.house_id;
    const bills = db
      .prepare(
        `SELECT id, period, total, status, due_date FROM bills
         WHERE house_id = ? ORDER BY period DESC LIMIT 6`
      )
      .all(houseId);
    const outstanding = db
      .prepare(
        `SELECT COALESCE(SUM(total),0) total, COUNT(*) n FROM bills
         WHERE house_id = ? AND status IN ('unpaid','overdue')`
      )
      .get(houseId);
    const complaints = db
      .prepare(
        `SELECT id, code, title, status, created_at FROM complaints
         WHERE created_by = ? ORDER BY created_at DESC LIMIT 5`
      )
      .all(req.user.id);
    const announcements = db
      .prepare(
        `SELECT id, title, body, category, published_at FROM announcements
         WHERE is_published = 1 ORDER BY published_at DESC LIMIT 5`
      )
      .all();
    const myInvites = db
      .prepare(
        `SELECT id, guest_name, purpose, valid_until, status FROM guest_invites
         WHERE created_by = ? AND status='active' AND valid_until >= datetime('now')
         ORDER BY valid_until ASC LIMIT 5`
      )
      .all(req.user.id);
    const unread = db
      .prepare(
        `SELECT COUNT(*) c FROM notifications
         WHERE (user_id = ? OR (user_id IS NULL AND broadcast_role = ?)) AND is_read = 0`
      )
      .get(req.user.id, req.user.role).c;
    return res.json({ role, bills, outstanding, complaints, announcements, myInvites, unread });
  }

  if (role === SATPAM) {
    const today = db
      .prepare(`SELECT COUNT(*) c FROM guest_visits WHERE date(check_in_at)=date('now')`).get().c;
    const inside = db
      .prepare(`SELECT COUNT(*) c FROM guest_visits WHERE check_out_at IS NULL`).get().c;
    const activeInvites = db
      .prepare(
        `SELECT COUNT(*) c FROM guest_invites WHERE status='active' AND valid_until >= datetime('now')`
      )
      .get().c;
    const recent = db
      .prepare(
        `SELECT gv.id, gv.guest_name, gv.purpose, gv.vehicle_plate, gv.method, gv.check_in_at, gv.check_out_at,
                h.number AS house_number, b.name AS block_name
         FROM guest_visits gv
         LEFT JOIN houses h ON h.id = gv.house_id
         LEFT JOIN blocks b ON b.id = h.block_id
         ORDER BY gv.check_in_at DESC LIMIT 10`
      )
      .all();
    const emergency = db
      .prepare(
        `SELECT c.id, c.code, c.title, c.status, c.created_at, u.name AS reporter, u.phone
         FROM complaints c JOIN users u ON u.id = c.created_by
         WHERE c.priority = 'darurat' AND c.status != 'selesai'
         ORDER BY c.created_at DESC LIMIT 5`
      )
      .all();
    return res.json({ role, today, inside, activeInvites, recent, emergency });
  }

  res.json({ role });
});

export default router;

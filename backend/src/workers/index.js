import dayjs from 'dayjs';
import { db, tx } from '../db.js';
import { bus, TOPICS } from '../events/bus.js';
import { currentPeriod } from '../utils/helpers.js';

/* ------------------------------------------------------------------ */
/* Notification Worker — fan-out notifikasi (simulasi push notification) */
/* ------------------------------------------------------------------ */

function notify({ userId = null, role = null, title, body, type = 'info', ref = null }) {
  db.prepare(
    `INSERT INTO notifications (user_id, broadcast_role, title, body, type, ref)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, role, title, body, type, ref);
}

function notifyRole(role, title, body, type = 'info', ref = null) {
  notify({ role, title, body, type, ref });
}

export function startNotificationWorker() {
  bus.subscribe(TOPICS.BILL_ISSUED, ({ houseId, period, total, count }) => {
    const house = db
      .prepare(
        `SELECT h.id, b.name AS block_name, h.number FROM houses h
         JOIN blocks b ON b.id = h.block_id WHERE h.id = ?`
      )
      .get(houseId);
    const owners = db
      .prepare(
        `SELECT u.id FROM users u WHERE u.house_id = ? AND u.role = 'warga' AND u.is_active = 1`
      )
      .all(houseId);
    for (const o of owners) {
      notify({
        userId: o.id,
        title: `Tagihan IPL ${period} terbit`,
        body: `Tagihan untuk ${house ? `Blok ${house.block_name} No. ${house.number}` : 'hunian Anda'} sebesar Rp ${total.toLocaleString('id-ID')} telah terbit. Jatuh tempo sesuai ketentuan.`,
        type: 'billing',
        ref: `bill:${houseId}:${period}`,
      });
    }
    if (count) {
      notifyRole('pengurus', 'Tagihan bulanan diterbitkan',
        `Sistem menerbitkan ${count} tagihan IPL periode ${period} secara otomatis.`, 'billing');
    }
  });

  bus.subscribe(TOPICS.PAYMENT_VERIFIED, ({ billId, amount, method, label }) => {
    const bill = db
      .prepare(
        `SELECT b.*, h.id AS hid, bl.name AS block_name, h.number FROM bills b
         JOIN houses h ON h.id = b.house_id JOIN blocks bl ON bl.id = h.block_id
         WHERE b.id = ?`
      )
      .get(billId);
    if (!bill) return;
    const addr = `Blok ${bill.block_name} No. ${bill.number}`;
    const warga = db
      .prepare(`SELECT id FROM users WHERE house_id = ? AND role = 'warga' AND is_active = 1`)
      .all(bill.hid);
    for (const w of warga) {
      notify({
        userId: w.id,
        title: 'Pembayaran berhasil diverifikasi ✔',
        body: `Pembayaran ${label || method} sebesar Rp ${amount.toLocaleString('id-ID')} untuk ${addr} (${bill.period}) telah terverifikasi. Terima kasih.`,
        type: 'billing',
        ref: `bill:${bill.id}`,
      });
    }
    notifyRole('pengurus', 'Pembayaran IPL terverifikasi',
      `${addr} — Rp ${amount.toLocaleString('id-ID')} (${label || method}) periode ${bill.period}.`, 'billing');
  });

  bus.subscribe(TOPICS.GUEST_CHECKIN, ({ visit }) => {
    if (!visit?.house_id) return;
    const warga = db
      .prepare(`SELECT id FROM users WHERE house_id = ? AND role = 'warga' AND is_active = 1`)
      .all(visit.house_id);
    for (const w of warga) {
      notify({
        userId: w.id,
        title: 'Tamu Anda telah masuk',
        body: `${visit.guest_name} tercatat masuk gerbang pukul ${dayjs(visit.check_in_at).format('HH:mm')} (${visit.vehicle_plate || 'tanpa kendaraan'}).`,
        type: 'guest',
        ref: `visit:${visit.id}`,
      });
    }
  });

  bus.subscribe(TOPICS.GUEST_CHECKOUT, ({ visit }) => {
    if (!visit?.house_id) return;
    const warga = db
      .prepare(`SELECT id FROM users WHERE house_id = ? AND role = 'warga' AND is_active = 1`)
      .all(visit.house_id);
    for (const w of warga) {
      notify({
        userId: w.id,
        title: 'Tamu Anda telah keluar',
        body: `${visit.guest_name} tercatat keluar gerbang pukul ${dayjs(visit.check_out_at).format('HH:mm')}.`,
        type: 'guest',
        ref: `visit:${visit.id}`,
      });
    }
  });

  bus.subscribe(TOPICS.COMPLAINT_CREATED, ({ complaint }) => {
    notifyRole('pengurus', `Pengaduan baru: ${complaint.title}`,
      `Kode ${complaint.code} dari ${complaint.house_label || 'warga'}. Kategori: ${complaint.category}.`,
      'complaint', `complaint:${complaint.id}`);
  });

  bus.subscribe(TOPICS.COMPLAINT_UPDATED, ({ complaint, message }) => {
    if (complaint.created_by) {
      notify({
        userId: complaint.created_by,
        title: `Pengaduan ${complaint.code} — status: ${complaint.status.toUpperCase()}`,
        body: message || 'Status pengaduan Anda diperbarui oleh pengurus.',
        type: 'complaint',
        ref: `complaint:${complaint.id}`,
      });
    }
  });

  bus.subscribe(TOPICS.ANNOUNCEMENT_PUBLISHED, ({ announcement }) => {
    // Push broadcast ke seluruh warga & satpam (fan-out async)
    for (const role of ['warga', 'satpam']) {
      notifyRole(role, `📢 ${announcement.title}`, announcement.body.slice(0, 180),
        'announcement', `announcement:${announcement.id}`);
    }
  });

  bus.subscribe(TOPICS.FINANCE_PUBLISHED, ({ report }) => {
    notifyRole('warga', 'Laporan keuangan diperbarui',
      `${report.title} (${report.type}) — Rp ${report.amount.toLocaleString('id-ID')} telah dipublikasikan.`,
      'finance', `finance:${report.id}`);
  });
}

/* ------------------------------------------------------------------ */
/* Payment Gateway Simulator — webhook otomatis (real-time settlement) */
/* ------------------------------------------------------------------ */

export function startPaymentGatewaySimulator() {
  bus.subscribe(TOPICS.PAYMENT_CREATED, ({ paymentId, simulate = true }) => {
    if (!simulate) return;
    // Simulasi callback webhook dari payment gateway setelah 4-8 detik
    const delay = 4000 + Math.floor(Math.random() * 4000);
    setTimeout(() => settlePayment(paymentId), delay);
  });
}

/** Menyelesaikan pembayaran seperti webhook gateway: verifikasi otomatis */
export function settlePayment(paymentId) {
  const pay = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId);
  if (!pay || pay.status !== 'pending') return;
  const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(pay.bill_id);
  if (!bill) return;

  tx(() => {
    db.prepare(
      `UPDATE payments SET status='verified', paid_at=datetime('now'),
       gateway_ref='GW-' || hex(randomblob(8)) WHERE id = ?`
    ).run(pay.id);
    db.prepare(`UPDATE bills SET status='paid' WHERE id = ?`).run(bill.id);
  });

  bus.publish(TOPICS.PAYMENT_VERIFIED, {
    billId: bill.id,
    amount: pay.amount,
    method: pay.method,
    label: pay.channel_label,
  });
  console.log(`[gateway-sim] payment #${pay.id} settled (webhook otomatis)`);
}

/* ------------------------------------------------------------------ */
/* Scheduler — tagihan otomatis tanggal 1, overdue, expire undangan QR */
/* ------------------------------------------------------------------ */

export function issueMonthlyBills(period = currentPeriod(), opts = { silent: false }) {
  const houses = db
    .prepare(
      `SELECT h.*, b.name AS block_name FROM houses h JOIN blocks b ON b.id = h.block_id
       WHERE h.status != 'perbaikan'`
    )
    .all();
  let created = 0;
  const due = dayjs(period + '-01').add(1, 'month').add(9, 'day').format('YYYY-MM-DD'); // tgl 10 bulan berikutnya
  const ins = db.prepare(
    `INSERT OR IGNORE INTO bills (house_id, period, ipl_amount, kebersihan_amount, keamanan_amount, total, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  tx(() => {
    for (const h of houses) {
      const total = h.ipl_rate + h.kebersihan_rate + h.keamanan_rate;
      if (total <= 0) continue;
      const r = ins.run(h.id, period, h.ipl_rate, h.kebersihan_rate, h.keamanan_rate, total, due);
      if (r.changes > 0) {
        created++;
        bus.publish(TOPICS.BILL_ISSUED, { houseId: h.id, period, total });
      }
    }
  });
  if (created > 0) {
    bus.publish(TOPICS.BILL_ISSUED, { houseId: null, period, count: created });
    console.log(`[scheduler] ${created} tagihan IPL periode ${period} diterbitkan.`);
  }
  return created;
}

function markOverdue() {
  const today = dayjs().format('YYYY-MM-DD');
  db.prepare(
    `UPDATE bills SET status='overdue' WHERE status='unpaid' AND due_date < ?`
  ).run(today);
}

function expireInvites() {
  db.prepare(
    `UPDATE guest_invites SET status='expired' WHERE status='active' AND valid_until < datetime('now')`
  ).run();
}

export function startScheduler() {
  // Pastikan tagihan bulan berjalan sudah terbit (idempotent)
  issueMonthlyBills(currentPeriod());
  markOverdue();
  expireInvites();
  // Jalankan pemeriksaan berkala tiap 60 detik
  setInterval(() => {
    issueMonthlyBills(currentPeriod());
    markOverdue();
    expireInvites();
  }, 60_000);
}

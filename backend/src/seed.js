/**
 * Seed data demo — The Quality Garden Residence.
 * Jalankan: node src/seed.js --force (rebuild total).
 */
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import QRCode from 'qrcode';
import { db, migrate, setSetting, tx } from './db.js';
import { generateToken, generateVA } from './utils/helpers.js';

migrate();

const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
if (userCount > 0 && !process.argv.includes('--force')) {
  console.log('[seed] Database sudah berisi data. Lewati seeding.');
  process.exit(0);
}
if (process.argv.includes('--force') && userCount > 0) {
  console.log('[seed] Mode force: membersihkan data lama...');
  db.exec(`
    DELETE FROM complaint_comments; DELETE FROM complaints; DELETE FROM audit_logs;
    DELETE FROM notifications; DELETE FROM announcements; DELETE FROM guest_visits;
    DELETE FROM guest_invites; DELETE FROM finance_reports; DELETE FROM payments;
    DELETE FROM bills; DELETE FROM occupants; DELETE FROM users; DELETE FROM houses;
    DELETE FROM blocks; DELETE FROM settings;
  `);
}

console.log('[seed] Mengisi data demo...');
const hash = (p) => bcrypt.hashSync(p, 10);

/* Pra-generate QR untuk undangan tamu (async di luar transaksi) */
const inviteDefs = [
  { houseKey: 'A-12', userKey: 'warga1', name: 'Paman Slamet', purpose: 'Silaturahmi keluarga', plate: 'B 1955 PQR', fromH: 0.1, durH: 8, status: 'active' },
  { houseKey: 'B-05', userKey: 'warga2', name: 'Rombongan Katering Rasa Bunda', purpose: 'Persiapan acara ulang tahun', plate: 'B 9021 KTR', fromH: 1, durH: 6, status: 'active' },
  { houseKey: 'C-08', userKey: 'warga3', name: 'Ratna Kusuma', purpose: 'Acara arisan keluarga', plate: 'D 1188 XY', fromH: -2, durH: 6, status: 'used' },
  { houseKey: 'E-02', userKey: 'warga6', name: 'Notaris Wibowo, S.H.', purpose: 'Penandatanganan dokumen', plate: 'B 1234 NTR', fromH: -30, durH: 4, status: 'expired' },
];
for (const def of inviteDefs) {
  def.token = generateToken(18);
  def.qr = await QRCode.toDataURL('QGR-GUEST:' + def.token, { width: 512, margin: 2, color: { dark: '#14532d' } });
  def.phone = '08' + Math.floor(100000000 + Math.random() * 899999999);
}

const seedAll = tx(() => {
  /* ------------------------------ Settings ----------------------------- */
  setSetting('estate_name', 'The Quality Garden Residence');
  setSetting('ipl_default_rate', '150000');
  setSetting('kebersihan_default_rate', '50000');
  setSetting('keamanan_default_rate', '75000');
  setSetting('bill_due_day', '10');
  setSetting('gate_name', 'Pos Gerbang Utama');
  setSetting('security_phone', '0812-0000-1111');

  /* ------------------------------- Blocks ------------------------------ */
  const blocks = [
    ['A', 'Cluster Flamboyan'], ['B', 'Cluster Bougenville'], ['C', 'Cluster Cempaka'],
    ['D', 'Cluster Damai'], ['E', 'Cluster Edelweiss'],
  ];
  const blockIds = {};
  for (const [name, cluster] of blocks) {
    blockIds[name] = db.prepare('INSERT INTO blocks (name, cluster) VALUES (?, ?)').run(name, cluster).lastInsertRowid;
  }

  /* ------------------------------- Houses ------------------------------ */
  const houseIds = {};
  const housePlan = {
    A: { count: 12, type: 'Tipe 45/90', ipl: 150000 },
    B: { count: 14, type: 'Tipe 60/120', ipl: 200000 },
    C: { count: 10, type: 'Tipe 70/140', ipl: 250000 },
    D: { count: 12, type: 'Tipe 45/90', ipl: 150000 },
    E: { count: 8, type: 'Tipe 90/180', ipl: 350000 },
  };
  const statuses = ['ditempati', 'ditempati', 'ditempati', 'ditempati', 'ditempati', 'kosong', 'perbaikan'];
  let si = 0;
  for (const [blk, plan] of Object.entries(housePlan)) {
    for (let n = 1; n <= plan.count; n++) {
      const num = String(n).padStart(2, '0');
      const status = statuses[(si++) % statuses.length];
      const id = db.prepare(
        `INSERT INTO houses (block_id, number, house_type, land_area, building_area, status, ipl_rate, kebersihan_rate, keamanan_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, 50000, 75000)`
      ).run(blockIds[blk], num, plan.type, Number(plan.type.split('/')[1]), Number(plan.type.split('/')[0]), status, plan.ipl).lastInsertRowid;
      houseIds[`${blk}-${num}`] = id;
    }
  }

  /* -------------------------------- Users ------------------------------ */
  const insUser = db.prepare(
    `INSERT INTO users (username, password_hash, name, role, phone, house_id, position) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const U = {};
  U.admin = insUser.run('admin', hash('admin123'), 'Rina Wijaya', 'super_admin', '0811-9000-1000', null, 'System Administrator').lastInsertRowid;
  U.pengurus = insUser.run('pengurus', hash('pengurus123'), 'Budi Santoso', 'pengurus', '0812-1111-2222', null, 'Ketua RT 007').lastInsertRowid;
  U.bendahara = insUser.run('bendahara', hash('bendahara123'), 'Siti Rahayu', 'pengurus', '0813-2222-3333', null, 'Bendahara RT 007').lastInsertRowid;
  U.satpam1 = insUser.run('satpam', hash('satpam123'), 'Agus Salim', 'satpam', '0857-4444-5555', null, 'Kepala Regu Keamanan').lastInsertRowid;
  U.satpam2 = insUser.run('satpam2', hash('satpam123'), 'Joko Suprapto', 'satpam', '0857-6666-7777', null, 'Anggota Regu Malam').lastInsertRowid;

  const wargaDefs = [
    ['warga1', 'Ahmad Fauzi', 'A-12', '0812-8888-0001', 'pemilik'],
    ['warga2', 'Dewi Lestari', 'B-05', '0812-8888-0002', 'pemilik'],
    ['warga3', 'Hendra Gunawan', 'C-08', '0812-8888-0003', 'pemilik'],
    ['warga4', 'Maya Sari', 'A-03', '0812-8888-0004', 'penyewa'],
    ['warga5', 'Rudi Hartono', 'D-11', '0812-8888-0005', 'pemilik'],
    ['warga6', 'Lina Marlina', 'E-02', '0812-8888-0006', 'pemilik'],
    ['warga7', 'Tono Wijaya', 'B-14', '0812-8888-0007', 'pemilik'],
    ['warga8', 'Sari Indah Permatasari', 'C-03', '0812-8888-0008', 'penyewa'],
  ];
  for (const [uname, name, houseKey, phone, relation] of wargaDefs) {
    const hid = houseIds[houseKey];
    U[uname] = insUser.run(uname, hash('warga123'), name, 'warga', phone, hid, 'Warga').lastInsertRowid;
    db.prepare(
      `INSERT INTO occupants (house_id, user_id, name, phone, relation, start_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(hid, U[uname], name, phone, relation, dayjs().subtract(1 + Math.floor(Math.random() * 40), 'month').format('YYYY-MM-DD'));
    db.prepare(`UPDATE houses SET status='ditempati' WHERE id=?`).run(hid);
  }
  db.prepare(
    `INSERT INTO occupants (house_id, name, phone, relation, start_date, end_date, is_active)
     VALUES (?, 'Bagus Prasetyo', '0812-7777-9999', 'penyewa', ?, ?, 0)`
  ).run(houseIds['A-03'], dayjs().subtract(30, 'month').format('YYYY-MM-DD'), dayjs().subtract(8, 'month').format('YYYY-MM-DD'));

  /* ------------------------ Bills & Payments (5 bln terakhir) ----------- */
  const insBill = db.prepare(
    `INSERT INTO bills (house_id, period, ipl_amount, kebersihan_amount, keamanan_amount, total, due_date, status, issued_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insPay = db.prepare(
    `INSERT INTO payments (bill_id, method, channel_label, va_number, amount, status, gateway_ref, paid_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?)`
  );
  const methods = [
    ['va_bca', 'Virtual Account BCA', '8808'],
    ['qris', 'QRIS', '9301'],
    ['gopay', 'GoPay', '9302'],
    ['cc', 'Kartu Kredit / Debit Online', '5410'],
    ['manual', 'Transfer Manual (verifikasi bendahara)', null],
  ];
  const houseList = db.prepare('SELECT * FROM houses').all();
  const today = dayjs();
  for (let m = 5; m >= 1; m--) {
    const period = today.subtract(m, 'month');
    const pStr = period.format('YYYY-MM');
    const dueDate = period.add(1, 'month').date(10).endOf('day');
    const issued = period.date(1).format('YYYY-MM-DD 06:00:00');
    for (const h of houseList) {
      if (h.status === 'perbaikan') continue;
      const total = h.ipl_rate + h.kebersihan_rate + h.keamanan_rate;
      let status;
      const rnd = Math.random();
      if (m === 1) status = rnd < 0.6 ? 'paid' : dueDate.isBefore(today) ? 'overdue' : 'unpaid';
      else status = rnd < 0.92 ? 'paid' : 'overdue';
      const billId = insBill.run(h.id, pStr, h.ipl_rate, h.kebersihan_rate, h.keamanan_rate, total,
        dueDate.format('YYYY-MM-DD'), status, issued).lastInsertRowid;
      if (status === 'paid') {
        const [method, label, prefix] = methods[Math.floor(Math.random() * methods.length)];
        const paidAt = dueDate.subtract(Math.floor(Math.random() * 10) + 1, 'day')
          .hour(10 + Math.floor(Math.random() * 10)).minute(Math.floor(Math.random() * 59))
          .format('YYYY-MM-DD HH:mm:ss');
        insPay.run(billId, method, label, prefix ? generateVA(prefix) : null, total,
          method === 'manual' ? 'MANUAL-SEED' : 'GW-SEED-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
          paidAt, null, paidAt);
      }
    }
  }

  /* --------------------------- Finance reports ------------------------- */
  const insFin = db.prepare(
    `INSERT INTO finance_reports (period, title, type, category, amount, description, published, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  );
  for (let m = 5; m >= 0; m--) {
    const period = today.subtract(m, 'month');
    const pStr = period.format('YYYY-MM');
    insFin.run(pStr, 'Gaji Petugas Keamanan (3 personil)', 'pengeluaran', 'keamanan', 9000000,
      'Pembayaran gaji bulanan satpam regu pagi, sore, dan malam.', U.bendahara, period.date(2).format('YYYY-MM-DD 09:00:00'));
    insFin.run(pStr, 'Gaji Petugas Kebersihan & Taman', 'pengeluaran', 'kebersihan', 5500000,
      '2 petugas kebersihan dan 1 tukang taman.', U.bendahara, period.date(2).format('YYYY-MM-DD 09:10:00'));
    insFin.run(pStr, 'Listrik PJU & Air Fasilitas Umum', 'pengeluaran', 'utilitas', 2300000,
      'Penerangan jalan umum, pos gerbang, dan musala.', U.bendahara, period.date(5).format('YYYY-MM-DD 10:00:00'));
    if (m % 2 === 0) {
      insFin.run(pStr, 'Pemeliharaan Taman & Playground', 'pengeluaran', 'fasilitas', 1800000 + m * 100000,
        'Pemotongan rumput, pemupukan, dan perawatan alat bermain anak.', U.bendahara, period.date(12).format('YYYY-MM-DD 08:30:00'));
    }
    if (m === 3) {
      insFin.run(pStr, 'Perbaikan Pompa Air & Tandon Cluster C', 'pengeluaran', 'perbaikan', 4750000,
        'Penggantian pompa jetpump dan pembersihan tandon.', U.bendahara, period.date(18).format('YYYY-MM-DD 11:00:00'));
    }
    insFin.run(pStr, 'Kas Kegiatan Warga (17-an, arisan, dll.)', 'pemasukan', 'kegiatan', 1200000,
      'Sumbangan sukarela warga dan hasil usaha kantin balai warga.', U.bendahara, period.date(8).format('YYYY-MM-DD 15:00:00'));
    if (m === 1) {
      insFin.run(pStr, 'Sewa Balai Warga — Acara Keluarga Bpk. Hendra', 'pemasukan', 'sewa fasilitas', 750000,
        'Sewa 1 hari termasuk kebersihan pasca-acara.', U.bendahara, period.date(20).format('YYYY-MM-DD 16:00:00'));
    }
  }

  /* -------------------------- Guest invites & visits ------------------- */
  const insInv = db.prepare(
    `INSERT INTO guest_invites (house_id, created_by, guest_name, guest_phone, purpose, vehicle_plate, valid_from, valid_until, token, qr_image, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insVisit = db.prepare(
    `INSERT INTO guest_visits (invite_id, house_id, guest_name, guest_phone, purpose, vehicle_plate, method, check_in_at, check_out_at, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const invIds = {};
  for (const def of inviteDefs) {
    invIds[def.name] = insInv.run(houseIds[def.houseKey], U[def.userKey], def.name, def.phone, def.purpose, def.plate,
      dayjs().add(def.fromH, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      dayjs().add(def.fromH + def.durH, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      def.token, def.qr, def.status).lastInsertRowid;
  }
  insVisit.run(null, houseIds['B-05'], 'Kurir JNE — Samsul', '081298765432', 'Pengiriman paket', 'B 9123 QGR', 'manual',
    today.subtract(3, 'hour').format('YYYY-MM-DD HH:mm:ss'), today.subtract(170, 'minute').format('YYYY-MM-DD HH:mm:ss'), U.satpam1);
  insVisit.run(null, houseIds['A-12'], 'Teknisi AC — Deni', '081345678901', 'Service AC rutin', 'B 4521 TTZ', 'manual',
    today.subtract(70, 'minute').format('YYYY-MM-DD HH:mm:ss'), null, U.satpam1);
  insVisit.run(invIds['Ratna Kusuma'], houseIds['C-08'], 'Ratna Kusuma', '081234500011', 'Acara arisan keluarga', 'D 1188 XY', 'qr',
    today.subtract(90, 'minute').format('YYYY-MM-DD HH:mm:ss'), today.subtract(20, 'minute').format('YYYY-MM-DD HH:mm:ss'), U.satpam1);
  insVisit.run(null, houseIds['D-11'], 'Tamu — Michael Tan', '081177889900', 'Meeting kerja', 'B 2201 MK', 'manual',
    today.subtract(1, 'day').hour(14).format('YYYY-MM-DD HH:mm:ss'), today.subtract(1, 'day').hour(16).format('YYYY-MM-DD HH:mm:ss'), U.satpam2);

  /* ----------------------------- Complaints ---------------------------- */
  const insC = db.prepare(
    `INSERT INTO complaints (code, house_id, created_by, category, title, description, location_text, status, priority, assigned_to, created_at, updated_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insCc = db.prepare('INSERT INTO complaint_comments (complaint_id, user_id, message, created_at) VALUES (?, ?, ?, ?)');
  const c1 = insC.run('TRX-2508-0001', houseIds['A-12'], U.warga1, 'Penerangan (PJU)',
    'Lampu jalan depan Blok A mati 3 titik',
    'Lampu PJU di depan rumah A-10 s.d. A-14 mati sejak minggu lalu, jalanan gelap saat malam.',
    'Jl. Flamboyan depan No. A-10 s.d. A-14', 'selesai', 'normal', U.satpam1,
    today.subtract(12, 'day').format('YYYY-MM-DD HH:mm:ss'), today.subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss'),
    today.subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss')).lastInsertRowid;
  insCc.run(c1, U.pengurus, 'Terima kasih laporannya, sudah kami teruskan ke teknisi listrik lingkungan.', today.subtract(11, 'day').format('YYYY-MM-DD HH:mm:ss'));
  insCc.run(c1, U.pengurus, 'Teknisi akan datang Kamis sore membawa 3 bohlam LED baru.', today.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'));
  insCc.run(c1, U.warga1, 'Sudah menyala semua, terima kasih pengurus!', today.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'));

  const c2 = insC.run('TRX-2509-0001', houseIds['B-05'], U.warga2, 'Kebersihan Lingkungan',
    'Sampah menumpuk di TPS Cluster Bougenville',
    'TPS penuh dan belum diangkut 2 hari, bau menyebar sampai rumah B-04.',
    'TPS samping pos Cluster B', 'diproses', 'tinggi', U.satpam2,
    today.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'), today.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'), null).lastInsertRowid;
  insCc.run(c2, U.pengurus,
    'Sudah dijadwalkan pengangkutan tambahan besok pagi dan vendor pengangkut telah ditegur.', today.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'));

  insC.run('TRX-2509-0002', houseIds['D-11'], U.warga5, 'Keamanan & Ketertiban',
    'Orang tidak dikenal mengetuk beberapa rumah malam hari',
    'Sekitar pukul 23.30 ada orang mengetuk 3 rumah di Blok D lalu pergi. Mohon patroli ditingkatkan.',
    'Jl. Damai blok D', 'menunggu', 'darurat', null,
    today.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), today.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), null);

  insC.run('TRX-2509-0003', houseIds['C-03'], U.warga8, 'Jalan & Drainase',
    'Genangan air di depan C-03 saat hujan',
    'Selokan depan rumah tersumbat, air meluap ke jalan setiap hujan deras.',
    'Depan rumah C-03', 'menunggu', 'normal', null,
    today.subtract(6, 'hour').format('YYYY-MM-DD HH:mm:ss'), today.subtract(6, 'hour').format('YYYY-MM-DD HH:mm:ss'), null);

  insC.run('TRX-2507-0001', houseIds['E-02'], U.warga6, 'Taman & Penghijauan',
    'Rumput taman bermain anak sudah tinggi',
    'Taman playground dekat Cluster E perlu dipotong, sempat terlihat ular kecil.',
    'Playground Cluster E', 'selesai', 'normal', U.satpam1,
    today.subtract(45, 'day').format('YYYY-MM-DD HH:mm:ss'), today.subtract(40, 'day').format('YYYY-MM-DD HH:mm:ss'),
    today.subtract(40, 'day').format('YYYY-MM-DD HH:mm:ss'));

  /* --------------------------- Announcements --------------------------- */
  const insA = db.prepare(
    `INSERT INTO announcements (title, body, category, is_published, published_at, created_by) VALUES (?, ?, ?, 1, ?, ?)`
  );
  insA.run('Kerja Bakti Bersama — Minggu, 07.00 WIB',
    'Mengundang seluruh warga untuk kerja bakti membersihkan taman dan selokan menjelang musim hujan. Titik kumpul di Balai Warga. Sarapan disediakan oleh ibu-ibu PKK. Mari jaga lingkungan kita bersama!',
    'kegiatan', today.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'), U.pengurus);
  insA.run('Jadwal Fogging Nyamuk DBD Serentak',
    'Fogging akan dilakukan Sabtu pagi mulai pukul 08.00. Mohon tutup makanan, amankan hewan peliharaan, dan buka jendela setelah selesai. Dimulai dari Cluster A → B → C → D → E.',
    'kesehatan', today.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'), U.pengurus);
  insA.run('Pemeliharaan Gardu Listrik — Sabtu 22.00-24.00',
    'PLN akan melakukan pemeliharaan gardu sehingga listrik padam sementara pada Sabtu malam pukul 22.00–24.00. Mohon simpan air dan charge perangkat sebelumnya.',
    'infrastruktur', today.subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss'), U.bendahara);
  insA.run('Laporan Keuangan RT 007 — Transparansi Kas Warga',
    'Laporan kas masuk dan keluar bulan lalu telah diunggah ke sistem dan dapat dipantau oleh seluruh warga melalui menu Keuangan. Total pemasukan IPL naik 8% berkat kolektibilitas warga yang semakin baik. Terima kasih!',
    'keuangan', today.subtract(15, 'day').format('YYYY-MM-DD HH:mm:ss'), U.bendahara);
  insA.run('Aturan Baru Tamu Menginap di Lingkungan QGR',
    'Tamu yang menginap lebih dari 1x24 jam wajib dilaporkan ke pos keamanan melalui aplikasi (fitur Tamu Digital) atau buku tamu manual. Ketentuan ini untuk kenyamanan dan keamanan bersama.',
    'keamanan', today.subtract(25, 'day').format('YYYY-MM-DD HH:mm:ss'), U.pengurus);

  /* ---------------------------- Audit logs ----------------------------- */
  db.prepare(
    `INSERT INTO audit_logs (user_id, username, action, entity, details, created_at) VALUES
     (?, 'admin', 'LOGIN', 'auth', '{"info":"seed"}', datetime('now','-2 hours')),
     (?, 'pengurus', 'CREATE_ANNOUNCEMENT', 'announcement', '{"title":"Kerja Bakti Bersama"}', datetime('now','-2 days')),
     (?, 'bendahara', 'VERIFY_PAYMENT', 'payment', '{"info":"seed"}', datetime('now','-3 days'))`
  ).run(U.admin, U.pengurus, U.bendahara);
});

console.log('[seed] Selesai. Akun demo:');
console.log('  admin/admin123 (Super Admin) | pengurus/pengurus123 | bendahara/bendahara123');
console.log('  satpam/satpam123 (Satpam)    | warga1..warga8 / warga123 (Warga)');

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/** Helper transaksi (pengganti db.transaction milik better-sqlite3) */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* noop */ }
    throw err;
  }
}

export function migrate() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    cluster TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER NOT NULL REFERENCES blocks(id),
    number TEXT NOT NULL,
    house_type TEXT,
    land_area INTEGER,
    building_area INTEGER,
    status TEXT NOT NULL DEFAULT 'ditempati' CHECK (status IN ('ditempati','kosong','perbaikan')),
    ipl_rate INTEGER NOT NULL DEFAULT 0,
    kebersihan_rate INTEGER NOT NULL DEFAULT 0,
    keamanan_rate INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (block_id, number)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin','pengurus','warga','satpam')),
    phone TEXT,
    house_id INTEGER REFERENCES houses(id),
    position TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS occupants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_id INTEGER NOT NULL REFERENCES houses(id),
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    phone TEXT,
    relation TEXT NOT NULL DEFAULT 'pemilik' CHECK (relation IN ('pemilik','penyewa','anggota')),
    start_date TEXT,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_id INTEGER NOT NULL REFERENCES houses(id),
    period TEXT NOT NULL,
    ipl_amount INTEGER NOT NULL DEFAULT 0,
    kebersihan_amount INTEGER NOT NULL DEFAULT 0,
    keamanan_amount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','overdue','void')),
    issued_at TEXT DEFAULT (datetime('now')),
    UNIQUE (house_id, period)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL REFERENCES bills(id),
    method TEXT NOT NULL,
    channel_label TEXT,
    va_number TEXT,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','expired')),
    gateway_ref TEXT,
    proof_path TEXT,
    note TEXT,
    paid_at TEXT,
    verified_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS finance_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('pemasukan','pengeluaran')),
    category TEXT,
    amount INTEGER NOT NULL,
    description TEXT,
    attachment_path TEXT,
    published INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guest_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_id INTEGER NOT NULL REFERENCES houses(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    purpose TEXT,
    vehicle_plate TEXT,
    valid_from TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    qr_image TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired','cancelled')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guest_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invite_id INTEGER REFERENCES guest_invites(id),
    house_id INTEGER REFERENCES houses(id),
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    purpose TEXT,
    vehicle_plate TEXT,
    id_photo_path TEXT,
    method TEXT NOT NULL DEFAULT 'qr' CHECK (method IN ('qr','manual')),
    check_in_at TEXT DEFAULT (datetime('now')),
    check_out_at TEXT,
    recorded_by INTEGER REFERENCES users(id),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    house_id INTEGER REFERENCES houses(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    photo_path TEXT,
    location_text TEXT,
    lat REAL,
    lng REAL,
    status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('draft','menunggu','diproses','selesai','ditolak')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('rendah','normal','tinggi','darurat')),
    assigned_to INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS complaint_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT DEFAULT 'umum',
    is_published INTEGER NOT NULL DEFAULT 1,
    published_at TEXT DEFAULT (datetime('now')),
    created_by INTEGER REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    broadcast_role TEXT,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT DEFAULT 'info',
    ref TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    username TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bills_house ON bills(house_id, period);
  CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
  CREATE INDEX IF NOT EXISTS idx_invites_token ON guest_invites(token);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
  `);
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

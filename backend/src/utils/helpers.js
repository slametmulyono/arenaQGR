import crypto from 'node:crypto';
import dayjs from 'dayjs';
import { db } from '../db.js';

export const rupiah = (n) =>
  'Rp ' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

export function nowISO() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

export function currentPeriod(d = dayjs()) {
  return d.format('YYYY-MM');
}

export function generateToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateVA(prefix = '8808') {
  // Simulasi nomor Virtual Account dari payment gateway
  let body = '';
  for (let i = 0; i < 12; i++) body += crypto.randomInt(0, 10);
  return prefix + body;
}

export function generateComplaintCode() {
  const y = dayjs().format('YYMM');
  const row = db
    .prepare("SELECT COUNT(*) as c FROM complaints WHERE code LIKE ?")
    .get(`TRX-${y}-%`);
  const seq = String((row?.c || 0) + 1).padStart(4, '0');
  return `TRX-${y}-${seq}`;
}

export function audit({ user, action, entity, entityId, details, ip }) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user?.id ?? null,
    user?.username ?? 'system',
    action,
    entity ?? null,
    entityId != null ? String(entityId) : null,
    typeof details === 'string' ? details : JSON.stringify(details ?? {}),
    ip ?? null
  );
}

export function houseLabel(house) {
  if (!house) return '-';
  return `Blok ${house.block_name} No. ${house.number}`;
}

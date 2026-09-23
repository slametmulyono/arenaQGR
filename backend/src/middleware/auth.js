import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';

/** Verifikasi JWT dan memuat user aktif ke req.user */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db
      .prepare(
        `SELECT u.id, u.username, u.name, u.role, u.phone, u.house_id, u.position, u.is_active,
                h.number AS house_number, b.name AS block_name
         FROM users u
         LEFT JOIN houses h ON h.id = u.house_id
         LEFT JOIN blocks b ON b.id = h.block_id
         WHERE u.id = ?`
      )
      .get(payload.sub);
    if (!user || !user.is_active)
      return res.status(401).json({ error: 'Akun tidak aktif atau tidak ditemukan.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa.' });
  }
}

/** Role-Based Access Control (RBAC) */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Belum terautentikasi.' });
    if (roles.length && !roles.includes(req.user.role))
      return res
        .status(403)
        .json({ error: `Akses ditolak. Diperlukan peran: ${roles.join(' / ')}.` });
    next();
  };
}

export const ADMIN = 'super_admin';
export const PENGURUS = 'pengurus';
export const WARGA = 'warga';
export const SATPAM = 'satpam';
export const STAFF = [ADMIN, PENGURUS];

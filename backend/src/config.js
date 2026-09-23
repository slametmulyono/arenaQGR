import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 4000),
  host: '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'qgr-smart-system-dev-secret-change-in-production',
  jwtExpires: process.env.JWT_EXPIRES || '12h',
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'qgr.db'),
  uploadDir: path.join(__dirname, '..', 'uploads'),
  appName: 'QGR Smart System',
  estateName: 'The Quality Garden Residence',
  // URL publik aplikasi (dipakai sebagai isi QR code tamu)
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:5173',
  timezone: 'Asia/Jakarta',
};

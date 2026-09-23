import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { config } from '../config.js';
import { HttpError } from './error.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function makeUploader(subdir) {
  const dir = path.join(config.uploadDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED.has(file.mimetype))
        return cb(new HttpError(400, 'Format file tidak didukung. Gunakan JPG/PNG/WEBP/PDF.'));
      cb(null, true);
    },
  }).single('file');
}

export const uploadComplaint = makeUploader('complaints');
export const uploadGuest = makeUploader('guests');
export const uploadFinance = makeUploader('finance');
export const uploadPayment = makeUploader('payments');

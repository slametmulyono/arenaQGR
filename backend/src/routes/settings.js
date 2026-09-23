import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { authenticate, authorize, ADMIN, PENGURUS, WARGA, SATPAM } from '../middleware/auth.js';
import { audit } from '../utils/helpers.js';

const router = Router();

const DEFAULTS = {
  estate_name: 'The Quality Garden Residence',
  ipl_default_rate: '150000',
  kebersihan_default_rate: '50000',
  keamanan_default_rate: '75000',
  bill_due_day: '10',
  gate_name: 'Pos Gerbang Utama',
  security_phone: '0812-0000-1111',
  maintenance_notice: '',
};

/** GET /api/settings/public — konfigurasi publik (untuk halaman login dll.) */
router.get('/public', (req, res) => {
  res.json({
    settings: {
      estate_name: getSetting('estate_name', DEFAULTS.estate_name),
      gate_name: getSetting('gate_name', DEFAULTS.gate_name),
      security_phone: getSetting('security_phone', DEFAULTS.security_phone),
    },
  });
});

router.use(authenticate);

/** GET /api/settings — semua setting (staff) */
router.get('/', authorize(ADMIN, PENGURUS), (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = { ...DEFAULTS };
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings, defaults: DEFAULTS });
});

/** PUT /api/settings — ubah setting (Super Admin) */
router.put('/', authorize(ADMIN), (req, res) => {
  const updates = req.body || {};
  for (const [k, v] of Object.entries(updates)) {
    if (k in DEFAULTS || ['estate_name'].includes(k)) setSetting(k, v);
  }
  audit({ user: req.user, action: 'UPDATE_SETTINGS', entity: 'settings', details: updates, ip: req.ip });
  res.json({ ok: true });
});

export default router;

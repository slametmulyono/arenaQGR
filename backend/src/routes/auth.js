import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { audit } from '../utils/helpers.js';

const router = Router();

/** POST /api/auth/login — otentikasi berbasis token (JWT) */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    audit({ user: null, action: 'LOGIN_FAILED', entity: 'auth', details: { username }, ip: req.ip });
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  if (!user.is_active)
    return res.status(403).json({ error: 'Akun dinonaktifkan. Hubungi Super Admin.' });

  const token = jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpires }
  );

  audit({ user, action: 'LOGIN', entity: 'auth', ip: req.ip });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      position: user.position,
      house_id: user.house_id,
    },
  });
});

/** GET /api/auth/me — profil user yang sedang login */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;

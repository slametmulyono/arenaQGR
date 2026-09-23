import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dayjs from 'dayjs';
import 'dayjs/locale/id.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { config } from './config.js';
import { db, migrate, getSetting } from './db.js';
import { notFound, errorHandler } from './middleware/error.js';
import { startNotificationWorker, startPaymentGatewaySimulator, startScheduler } from './workers/index.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import housingRoutes from './routes/housing.js';
import userRoutes from './routes/users.js';
import billRoutes from './routes/bills.js';
import paymentRoutes from './routes/payments.js';
import financeRoutes from './routes/finance.js';
import guestRoutes from './routes/guests.js';
import complaintRoutes from './routes/complaints.js';
import announcementRoutes from './routes/announcements.js';
import notificationRoutes from './routes/notifications.js';
import logRoutes from './routes/logs.js';
import settingsRoutes from './routes/settings.js';

dayjs.locale('id');

migrate();

// Auto-seed bila database masih kosong (first run)
const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
if (userCount === 0) {
  console.log('[boot] Database kosong — menjalankan seeding data demo...');
  const { execSync } = await import('node:child_process');
  const backendRoot = path.resolve(__dirname, '..');
  execSync('node src/seed.js', { cwd: backendRoot, stdio: 'inherit' });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(config.uploadDir));

// Request logging ringkas + waktu respons (NFR: pantau performa API)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (ms > 2000) console.warn(`[slow-api] ${req.method} ${req.originalUrl} → ${ms}ms`);
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: config.appName,
    estate: getSetting('estate_name', config.estateName),
    version: '1.0.0',
    time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    uptime_sec: Math.round(process.uptime()),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/housing', housingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/settings', settingsRoutes);

app.use(notFound);
app.use(errorHandler);

// Jalankan worker async (event-driven) & scheduler tagihan otomatis
startNotificationWorker();
startPaymentGatewaySimulator();
startScheduler();

app.listen(config.port, config.host, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  QGR Smart System — REST API                                 ║
║  ${config.estateName.padEnd(56)} ║
║  API  : http://${config.host}:${config.port}/api                                   ║
║  Health: http://${config.host}:${config.port}/api/health                            ║
╚══════════════════════════════════════════════════════════════╝`);
});

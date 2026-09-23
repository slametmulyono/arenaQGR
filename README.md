# 🏡 QGR Smart System — Sistem Informasi Perumahan The Quality Garden Residence

Aplikasi tata kelola lingkungan perumahan berbasis **API-First** sesuai PRD (lihat [`docs/PRD.md`](docs/PRD.md)):
mendigitalisasi iuran IPL, keamanan gerbang dengan QR tamu, ticketing pengaduan warga, dan transparansi
pengumuman/keuangan — dengan pemisahan peran **Super Admin, Pengurus/Bendahara (Web Dashboard)** dan
**Warga, Satpam (Mobile Web App)**.

![stack](https://img.shields.io/badge/stack-Node.js%20%2B%20Express%20%2B%20React%20%2B%20Vite%20%2B%20Tailwind-emerald)

## ✨ Fitur (Fase 1 — Core MVP)

| Modul | Kemampuan |
| --- | --- |
| **Hunian & Pengguna** | Data master blok/rumah, status hunian (ditempati/kosong/perbaikan), riwayat penghuni (pemilik/penyewa), RBAC 4 peran, otentikasi JWT |
| **Keuangan & IPL** | Tagihan otomatis tiap tanggal 1 (scheduler), pembayaran VA/e-wallet/QRIS/kartu dengan **verifikasi otomatis real-time** (simulasi webhook payment gateway), transfer manual + unggah bukti + verifikasi bendahara, laporan kas masuk/keluar yang dipublikasikan ke warga |
| **Keamanan & Tamu Digital** | Undangan QR unik berbatas waktu (*expiring token*), pemindaian pos gerbang (kamera + input manual) dengan check-in/check-out otomatis, buku tamu manual (foto identitas & plat kendaraan), notifikasi ke warga saat tamunya masuk/keluar |
| **Pengaduan (Ticketing)** | Laporan dengan foto + lokasi (GPS/manual), prioritas hingga 🚨 darurat (muncul di aplikasi satpam), alur resolusi `menunggu → diproses → selesai` dengan penugasan PIC dan timeline komentar |
| **Pengumuman & Notifikasi** | Broadcast edaran resmi → fan-out notifikasi push (in-app) ke seluruh warga & satpam via event bus async |
| **Super Admin** | Audit log seluruh aksi, jejak event bus, manajemen user & reset password, pengaturan tarif/sistem |

## 🧱 Arsitektur

```
[ Mobile Web App: Warga & Satpam ]   [ Web Dashboard: Admin & Pengurus ]
                 │                                  │
                 └──────────────┬───────────────────┘
                                │  REST API (JSON, JWT)
                                ▼
                    [ Backend Express — API Gateway ]
                                │
      ┌─────────────────────────┼──────────────────────────┐
      ▼                         ▼                          ▼
 Modul Auth/RBAC        Modul IPL/Keuangan          Modul Tamu/Ticketing
      │                         │                          │
      └────────────┬────────────┴────────────┬─────────────┘
                   ▼                         ▼
        [ Database Layer (SQLite WAL) ]  [ EventBus — async workers ]
        skema kompatibel PostgreSQL      (notifikasi, webhook gateway,
                                          scheduler tagihan otomatis)
```

- **API-First** — semua fungsi diekspos via RESTful API (`/api/*`) sehingga klien baru (smart display pos, IoT gate) mudah ditambahkan.
- **Event-Driven** — `src/events/bus.js` mengabstraksikan *message broker*; publisher/worker dapat dipindah ke RabbitMQ/Kafka tanpa mengubah modul.
- **Async jobs** — fan-out notifikasi massal, settlement webhook gateway, dan scheduler tagihan berjalan di luar request cycle (latensi API rendah).
- **Keamanan** — JWT (exp 12 jam), bcrypt, RBAC per-endpoint, audit trail, upload tervalidasi (tipe & ukuran).
- **Skalabilitas DB** — SQLite mode WAL untuk dev; skema SQL portabel ke PostgreSQL + Redis (caching/session) untuk produksi.

## 📂 Struktur

```
backend/            REST API (Express, port 4000)
  src/
    index.js        bootstrap server + auto-seed
    db.js           migrasi skema + helper transaksi
    config.js       konfigurasi (JWT, path, dsb.)
    events/bus.js   abstraksi message broker (EventBus)
    workers/        notification worker, gateway simulator, scheduler IPL
    middleware/     auth (JWT+RBAC), upload, error handler
    routes/         auth, dashboard, housing, users, bills, payments,
                    finance, guests, complaints, announcements,
                    notifications, logs, settings
  data/qgr.db       database (otomatis dibuat, gitignored)
  uploads/          foto pengaduan/bukti bayar/identitas tamu (gitignored)

frontend/           React SPA (Vite + Tailwind, port 5173)
  src/pages/web/    dashboard Super Admin & Pengurus
  src/pages/warga/  aplikasi mobile warga (bottom-nav)
  src/pages/gate/   aplikasi pos gerbang satpam (scanner QR)

docs/PRD.md         Product Requirements Document sumber
```

## 🚀 Menjalankan

Prasyarat: **Node.js ≥ 22.5** (memakai `node:sqlite` bawaan — tanpa native build).

```bash
# 1) Backend (API :4000) — auto-seed data demo saat pertama kali jalan
cd backend && npm install && npm start

# 2) Frontend (:5173, proxy /api → :4000)
cd frontend && npm install && npm run dev
```

Buka `http://localhost:5173`. Reset data demo: `cd backend && npm run seed`.

### 👤 Akun Demo

| Peran | Username | Password | Masuk ke |
| --- | --- | --- | --- |
| Super Admin | `admin` | `admin123` | Web Dashboard `/app` |
| Pengurus (Ketua RT) | `pengurus` | `pengurus123` | Web Dashboard `/app` |
| Bendahara | `bendahara` | `bendahara123` | Web Dashboard `/app` |
| Satpam | `satpam` | `satpam123` | Pos Gerbang `/gate` |
| Warga (8 KK) | `warga1` … `warga8` | `warga123` | Mobile Warga `/m` |

### 🧪 Skenario Uji Cepat

1. Login `warga1` → **Tagihan** → bayar via QRIS → status berubah **Lunas otomatis ±5-8 detik** (webhook gateway disimulasikan) → cek notifikasi.
2. Login `warga2` → **Tamu QR** → buat undangan → tampilkan/unduh QR.
3. Login `satpam` → **Scan QR** → tempel token / arahkan kamera → tamu tercatat **masuk**, warga ternotifikasi; scan ulang → tercatat **keluar**.
4. Login `warga3` → **Lapor** → buat pengaduan prioritas darurat dengan foto → login `pengurus` → proses, tugaskan PIC, selesaikan → warga melihat progres di timeline.
5. Login `pengurus` → **Pengumuman** → terbitkan edaran → semua warga & satpam menerima notifikasi push (in-app).
6. Login `admin` → **Log Aktivitas** → lihat audit trail & jejak event bus.

## 🗺️ Roadmap (sesuai PRD)

- **Fase 2** — IoT barrier gate (ANPR/RFID), panic button warga → pos satpam.
- **Fase 3** — marketplace internal warga, reservasi fasilitas umum.

## 🔒 Catatan Non-Fungsional

- Target uptime 99,5%: stateless API + worker idempotent memudahkan replikasi & load-balancing.
- Performa < 2 detik: middleware memantau request lambat (`[slow-api]` di log server).
- Produksi: aktifkan SSL/TLS di reverse proxy, enkripsi kolom sensitif (AES-256), ganti `JWT_SECRET`, migrasi SQLite → PostgreSQL, dan ganti EventBus → RabbitMQ/Kafka.

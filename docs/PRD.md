# PRD: Sistem Informasi Perumahan The Quality Garden Residence

---

## 1. Ringkasan Eksekutif & Tujuan

Dokumen ini mendefinisikan persyaratan produk untuk **Sistem Informasi Perumahan The Quality Garden Residence** (*QGR Smart System*). Sistem ini bertujuan untuk mendigitalisasi tata kelola lingkungan, mempercepat proses pembayaran iuran, meningkatkan sistem keamanan pemukiman, dan memberikan transparansi informasi antarwarga dan pengurus.

Sistem dirancang dengan arsitektur modular dan terpisah (*decoupled*) antara *backend* dan *frontend* agar mudah dikembangkan (*scaleable*) saat ada penambahan fitur di masa depan, seperti integrasi perangkat IoT gerbang otomatis atau marketplace internal.

---

## 2. Matriks Peran Pengguna (User Roles)

| Peran | Platform Utama | Hak Akses & Deskripsi Utama |
| --- | --- | --- |
| **Super Admin** | Web Dashboard | Mengelola konfigurasi sistem, hak akses user, data master blok/rumah, dan *log* aktivitas. |
| **Pengurus / Bendahara** | Web Dashboard | Mengelola tagihan IPL, memverifikasi pembayaran, menyusun laporan keuangan, dan menerbitkan pengumuman. |
| **Warga** | Mobile App (Android/iOS) | Membayar iuran, membuat QR code akses tamu, mengirim pengaduan fasilitas, dan melihat pengumuman. |
| **Satpam / Keamanan** | Mobile App (Android/iOS) | Memindai QR code tamu di gerbang, mencatat tamu manual, dan menerima rincian laporan darurat. |

---

## 3. Kebutuhan Fungsional (Functional Requirements)

### 3.1. Modul Manajemen Hunian & Pengguna

* **Data master hunian:** Pencatatan status rumah (ditempati, kosong, atau dalam perbaikan) beserta riwayat penghuni (pemilik atau penyewa).
* **Otentikasi & otorisasi:** Penggunaan *Role-Based Access Control* (RBAC) dan otentikasi berbasis token (JWT) untuk memastikan pemisahan akses antarakun.

### 3.2. Modul Keuangan & Iuran Pengelolaan Lingkungan (IPL)

* **Tagihan otomatis:** Sistem menerbitkan tagihan rutin bulanan (IPL, kebersihan, dan keamanan) secara otomatis setiap tanggal satu.
* **Integrasi *payment gateway*:** Pembayaran dapat dilakukan via *virtual account*, dompet digital, atau kartu kredit dengan status verifikasi otomatis (*real-time*).
* **Laporan keuangan transparan:** Pengurus dapat mengunggah laporan kas masuk dan keluar yang bisa dipantau langsung oleh warga secara ringkas.

### 3.3. Modul Keamanan & Tamu Digital

* **Undangan QR code:** Warga dapat meregenerasi QR code unik berbatas waktu (*expiring token*) untuk tamu, kurir, atau pekerja bangunan.
* **Pemindaian pos gerbang:** Satpam memindai QR code tamu di pintu masuk untuk mencatat waktu masuk dan keluar otomatis.
* **Buku tamu manual:** Fasilitas input manual oleh satpam untuk tamu tanpa undangan QR code, mencakup foto identitas dan plat nomor kendaraan.

### 3.4. Modul Pengaduan & Layanan Warga (*Ticketing*)

* **Pengajuan laporan:** Warga dapat mengunggah pengaduan terkait fasilitas umum atau gangguan lingkungan dengan melampirkan foto dan lokasi.
* **Alur kerja resolusi:** Penugasan pengaduan dari pengurus ke penanggung jawab teknis dengan status yang dapat dipantau (*Draft*, *Diproses*, *Selesai*).

### 3.5. Modul Pengumuman & Notifikasi

* **Broadcast pengumuman:** Pengurus dapat memublikasikan berita atau edaran resmi yang memicu notifikasi push (*push notification*) ke aplikasi mobile warga.

---

## 4. Arsitektur & Skalabilitas Sistem

Untuk menjamin sistem dapat berkembang tanpa perlu membongkar kode utama (*refactoring* skala besar), rancangan arsitektur wajib memenuhi ketentuan berikut:

```
[ Mobile App: Warga & Satpam ]    [ Web Dashboard: Admin & Pengurus ]
               │                                   │
               └───────────────┬───────────────────┘
                               │ (REST API / gRPC)
                               ▼
                      [ API Gateway ]
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
[ Microservice Auth ]   [ Microservice IPL ]   [ Microservice Tamu ]
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               ▼
                     [ Database Layer ]
               (PostgreSQL / Redis Caching)

```

* **Pendekatan API-First:** Seluruh fungsi *backend* diekspos melalui RESTful API atau gRPC, memudahkan penambahan klien baru di masa depan (misalnya *smart display* di pos atau aplikasi jam tangan pintar).
* **Skalabilitas basis data:** Menerapkan pemisahan antara data transaksi (*relational DB* seperti PostgreSQL) dan data *caching/session* (Redis) untuk menangani lonjakan lalu lintas data pada tanggal jatuh tempo pembayaran.
* **Event-Driven Architecture:** Menggunakan *message broker* (seperti RabbitMQ atau Kafka) untuk memproses pekerjaan di latar belakang (*async job*) seperti pengiriman notifikasi massal dan integrasi data sensor.

---

## 5. Rencana Pengembangan Masa Depan (Future Roadmap)

* **Fase 1 (Core MVP):** Manajemen warga, modul IPL & *payment gateway*, keamanan QR code, dan ticketing pengaduan.
* **Fase 2 (Integrasi IoT & Keamanan lanjut):** Integrasi *barrier gate* otomatis menggunakan pembaca plat nomor (ANPR) atau RFID, serta tombol darurat (*panic button*) di aplikasi warga yang terhubung ke pos satpam.
* **Fase 3 (Ekosistem Warga):** Fitur *marketplace* internal (jual-beli produk antartetangga) dan reservasi fasilitas umum perumahan (lapangan olahraga, balai warga).

---

## 6. Kebutuhan Non-Fungsional

* **Keamanan Data:** Enkripsi data sensitif menggunakan SSL/TLS saat transmisi data dan AES-256 untuk data yang tersimpan di basis data.
* **Ketersediaan (Availability):** Target *uptime* sistem sebesar 99,5% per bulan.
* **Performa:** Waktu respons API rata-rata di bawah dua detik untuk pemrosesan transaksi standar pada kondisi jaringan normal.

---

## Catatan Implementasi (Fase 1 — MVP ini)

Implementasi berjalan mengikuti PRD dengan penyesuaian pragmatis untuk lingkungan demo:

* **Microservice → modular monolith API-first:** seluruh domain (Auth, IPL, Tamu, Ticketing, Pengumuman) diekspos sebagai REST API terpisah per-modul sehingga mudah dipecah menjadi microservice tanpa mengubah kontrak API.
* **Message broker → EventBus in-process** (`backend/src/events/bus.js`): antarmuka publish/subscribe identik dengan pola RabbitMQ/Kafka; worker notifikasi, simulator webhook gateway, dan scheduler tagihan berjalan async.
* **PostgreSQL → SQLite (WAL)** untuk dev/demo; skema SQL portabel (lihat `backend/src/db.js`).
* **Mobile App (Android/iOS) → Mobile Web App** responsif bergaya native (bottom navigation) untuk Warga (`/m`) dan Satpam (`/gate`); dapat dibungkus Capacitor/PWA untuk distribusi store.
* **Payment gateway → simulator** dengan kanal VA BCA/Mandiri/BNI, QRIS, GoPay/OVO/DANA, kartu kredit, dan transfer manual; settlement otomatis meniru webhook real-time.

# Glosarium TKJ — Fase E & Fase F (Kurikulum Merdeka)

Kamus istilah **Teknik Komputer dan Jaringan** untuk siswa SMK: setiap istilah dijelaskan dengan bahasa sederhana (sering dengan analogi dan contoh angka nyata) **dan** disertai fungsinya/kegunaannya, sehingga mudah dipahami sekaligus langsung terhubung dengan praktik.

Istilah dikelompokkan mengikuti **elemen Capaian Pembelajaran (CP)**:

- **Fase E (Kelas X)** — mata pelajaran *Dasar-Dasar Teknik Jaringan Komputer dan Telekomunikasi (TJKT)*
- **Fase F (Kelas XI–XII)** — konsentrasi keahlian *Teknik Komputer dan Jaringan (TKJ)*

> **Total saat ini: 1.174 istilah dalam 14 kategori.** Jalankan `python3 tools/build.py` untuk melihat angka terbaru.

## Cara membaca

Pilih format yang paling nyaman:

| Format | File | Cocok untuk |
|---|---|---|
| **Interaktif (cari & filter)** | [`index.html`](index.html) | Belajar mandiri, mencari istilah cepat di HP/laptop, dicetak ke PDF |
| **Satu file lengkap** | [`GLOSARIUM-LENGKAP.md`](GLOSARIUM-LENGKAP.md) | Dibaca berurutan, dicetak per bab |
| **Per kategori** | folder [`fase-e/`](fase-e) dan [`fase-f/`](fase-f) | Menyertai satu topik pelajaran / modul ajar |
| **Indeks A–Z** | [`INDEKS-A-Z.md`](INDEKS-A-Z.md) | Menemukan di kategori mana sebuah istilah dijelaskan |
| **Spreadsheet** | [`glosarium-tkj.csv`](glosarium-tkj.csv) (pemisah `;`, UTF-8) | Dibuka di Excel/Google Sheets, dijadikan bank soal atau kartu hafalan |

Setiap tabel memiliki empat kolom: **No** · **Istilah** · **Pengertian** · **Fungsi / Kegunaan**. Khusus istilah ancaman/serangan (kategori Keamanan Jaringan), kolom *Fungsi* berisi **tujuan penyerang dan cara pencegahannya**.

## Peta materi

### Bagian A — Fase E (Kelas X): Dasar-Dasar TJKT

| Kode | Kategori | Elemen CP yang dicakup |
|---|---|---|
| 01 | [Proses Bisnis, Profesi, dan Kewirausahaan](fase-e/01-proses-bisnis-profesi-kewirausahaan.md) | Proses bisnis di bidang TJKT; Profesi dan kewirausahaan (job-profile & technopreneurship) |
| 02 | [Perkembangan Teknologi](fase-e/02-perkembangan-teknologi.md) | Perkembangan teknologi TJKT (5G, microwave link, IPv6, serat optik, IoT, data center, cloud, keamanan informasi) |
| 03 | [K3LH dan Budaya Kerja Industri](fase-e/03-k3lh-budaya-kerja.md) | K3LH dan budaya kerja industri |
| 04 | [Perangkat Keras Komputer dan Perakitan](fase-e/04-perangkat-keras-komputer.md) | Dasar-dasar TJKT (perakitan komputer) |
| 05 | [Sistem Operasi dan Perangkat Lunak Dasar](fase-e/05-sistem-operasi-perangkat-lunak.md) | Dasar-dasar TJKT (instalasi & konfigurasi sistem operasi) |
| 06 | [Dasar-Dasar Jaringan Komputer](fase-e/06-dasar-jaringan-komputer.md) | Dasar-dasar TJKT; Media dan jaringan telekomunikasi (IPv4/IPv6, TCP/IP, networking service) |
| 07 | [Media Transmisi dan Jaringan Telekomunikasi](fase-e/07-media-transmisi-telekomunikasi.md) | Media dan jaringan telekomunikasi (seluler, microwave, VSAT, optik, WLAN) |
| 08 | [Alat Ukur dan Alat Kerja Jaringan](fase-e/08-alat-ukur-alat-kerja.md) | Penggunaan alat ukur jaringan |

### Bagian B — Fase F (Kelas XI–XII): Konsentrasi Keahlian TKJ

| Kode | Kategori | Elemen CP yang dicakup |
|---|---|---|
| 09 | [Perencanaan dan Pengalamatan Jaringan](fase-f/09-perencanaan-pengalamatan-jaringan.md) | Perencanaan dan Pengalamatan Jaringan (topologi & arsitektur, kebutuhan pengguna, CIDR, VLSM, subnetting, IPv6) |
| 10 | [Teknologi Jaringan Kabel, Nirkabel, dan VoIP](fase-f/10-jaringan-kabel-nirkabel-voip.md) | Teknologi Jaringan Kabel dan Nirkabel (structured cabling, PoE, standar Wi-Fi, WLAN, outdoor link, fiber optic, VoIP) |
| 11 | [Pemasangan dan Konfigurasi Perangkat Jaringan](fase-f/11-pemasangan-konfigurasi-perangkat.md) | Pemasangan dan Konfigurasi Perangkat Jaringan (VLAN, routing statis/dinamis, NAT, proxy, bandwidth management, load balancing; MikroTik & Cisco) |
| 12 | [Keamanan Jaringan](fase-f/12-keamanan-jaringan.md) | Keamanan Jaringan (kebijakan, ancaman & serangan, firewall host/server, server autentikasi, IDS/IPS, pengamanan server, kriptografi) |
| 13 | [Administrasi Sistem Jaringan (Server)](fase-f/13-administrasi-sistem-jaringan.md) | Administrasi Sistem Jaringan (remote, DHCP, DNS, FTP, file, web, mail, database, control panel & hosting, VPS, VPN server, monitoring) |
| 14 | [Troubleshooting dan Pemeliharaan](fase-f/14-troubleshooting-pemeliharaan.md) | Lintas elemen: menganalisis permasalahan dan memperbaiki; pemeliharaan |

## Saran pemakaian di kelas

- **Siswa:** buka `index.html`, ketik istilah yang muncul di modul/soal, baca *Pengertian* lalu *Fungsi*-nya; gunakan tombol "cari di nama istilah saja" untuk latihan hafalan.
- **Guru:** tiap file kategori bisa dilampirkan pada modul ajar elemen terkait; kolom CSV mudah diubah menjadi kartu istilah, kuis, atau teka-teki silang.
- **Persiapan UKK/sertifikasi:** kategori 09–13 memuat istilah yang paling sering muncul pada soal UKK TKJ, MTCNA, dan CCNA.

## Menyunting dan membangun ulang

1. Sunting file sumber di `fase-e/` atau `fase-f/`. Aturan format tiap baris tabel:
   `| No | **Istilah** | Pengertian | Fungsi / Kegunaan |` — satu paragraf per sel, **jangan memakai karakter `|` di dalam sel**, nomor berurutan mulai 1 di tiap file.
2. Jalankan dari folder ini:

   ```bash
   python3 tools/build.py
   ```

   Skrip memvalidasi tabel (jumlah kolom, sel kosong, urutan nomor, istilah ganda) lalu menghasilkan ulang `GLOSARIUM-LENGKAP.md`, `INDEKS-A-Z.md`, `glosarium-tkj.csv`, dan `index.html`. Tidak ada pustaka tambahan yang dibutuhkan (Python 3.8+).

## Catatan

- Angka teknis (kecepatan standar, port, redaman, batas panjang kabel) mengacu pada standar IEEE/TIA/ITU dan dokumentasi vendor yang berlaku saat glosarium disusun; periksa dokumentasi terbaru bila dipakai untuk pekerjaan nyata.
- Nama produk dan merek (MikroTik, Cisco, Ubiquiti, dsb.) disebut sebagai contoh yang lazim ditemui di sekolah dan industri Indonesia, bukan sebagai promosi.

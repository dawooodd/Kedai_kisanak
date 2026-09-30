# ☕ Kedai Kisanak — Modern Coffee Shop Point of Sale (POS)

[![Netlify Status](https://api.netlify.com/api/v1/badges/deploy-status)](https://kedaikisanak.netlify.app)
[![Web Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA%20Ready-C8956C?style=flat&logo=googlechrome&logoColor=white)](https://kedaikisanak.netlify.app)
[![Vanilla JS](https://img.shields.io/badge/Architecture-Vanilla%20JS%20(ES6%20Modules)-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://kedaikisanak.netlify.app)
[![Security Audited](https://img.shields.io/badge/Security-Strict%20CSP%20%2B%20HMAC--SHA256-10B981?style=flat&logo=securityscorecard&logoColor=white)](https://kedaikisanak.netlify.app)
[![Deployment](https://img.shields.io/badge/Hosted%20On-Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)](https://kedaikisanak.netlify.app)

> **Live Production URL**: [https://kedaikisanak.netlify.app](https://kedaikisanak.netlify.app)  
> *Sistem Point of Sale (POS) kedai kopi modern, cepat, elegan, dan aman. Dirancang khusus untuk mempermudah operasional kasir kedai kopi specialty dengan estetika visual berkelas serta standar keamanan web enterprise.*

---

## 📋 Daftar Isi
1. [Sekilas Tentang Aplikasi](#-sekilas-tentang-aplikasi)
2. [Fitur-Fitur Utama & Rinci](#-fitur-fitur-utama--rinci)
3. [Arsitektur Keamanan (Cybersecurity Built-in)](#-arsitektur-keamanan-cybersecurity-built-in)
4. [Panduan Operasional Kasir di Netlify](#-panduan-operasional-kasir-di-netlify)
   - [Langkah 1: Membuka Sistem Kasir](#langkah-1-membuka-sistem-kasir)
   - [Langkah 2: Memilih Menu & Filter Kategori](#langkah-2-memilih-menu--filter-kategori)
   - [Langkah 3: Mengatur Data Pesanan Pelanggan](#langkah-3-mengatur-data-pesanan-pelanggan)
   - [Langkah 4: Proses Pembayaran (Tunai, QRIS, Kartu)](#langkah-4-proses-pembayaran-tunai-qris-kartu)
   - [Langkah 5: Cetak Struk Belanja (Thermal Receipt)](#langkah-5-cetak-struk-belanja-thermal-receipt)
   - [Langkah 6: Cek Riwayat & Audit Transaksi](#langkah-6-cek-riwayat--audit-transaksi)
   - [Langkah 7: Fitur Scan QR Voucher / Meja](#langkah-7-fitur-scan-qr-voucher--meja)
   - [Langkah 8: Tutup Shift / Reset Database](#langkah-8-tutup-shift--reset-database)
5. [Konfigurasi & Deployment di Netlify](#-konfigurasi--deployment-di-netlify)
6. [Menjalankan di Komputer Lokal (Local Development)](#-menjalankan-di-komputer-lokal-local-development)
7. [Struktur Direktori Proyek](#-struktur-direktori-proyek)
8. [Spesifikasi Teknis](#-spesifikasi-teknis)

---

## ☕ Sekilas Tentang Aplikasi

**Kedai Kisanak POS** adalah aplikasi kasir berbasis web murni (*Client-Side Web Application*) tanpa dependensi server backend eksternal yang berat. Menggunakan standar **Native Vanilla JavaScript (ES6 Modules)**, sistem ini menyajikan performa instan dengan waktu muat *(load time)* kurang dari 1 detik di Netlify CDN.

Aplikasi ini menggabungkan kemudahan kasir saat jam sibuk (*rush hour*) dengan sistem penyimpanan data lokal terisolasi (**IndexedDB** & **LocalStorage**) yang dilindungi oleh tanda tangan integritas kriptografi berstandar militer (**Web Crypto API SHA-256**).

---

## ✨ Fitur-Fitur Utama & Rinci

### 1. 🛍️ Katalog Menu Interaktif
- **Kategori Khusus Kopi & Makanan**:
  - `Espresso Based` (Espresso, Americano, Cafe Latte, Cappuccino, Caramel Macchiato)
  - `Manual Brew` (V60 Pour Over, Japanese Iced, Aeropress)
  - `Non-Coffee` (Matcha Latte, Red Velvet, Artisan Tea, Chocolate Drink)
  - `Pastry & Food` (Butter Croissant, Almond Croissant, Cheesecake, French Fries, Mix Platter)
- **One-Tap Fast Ordering**: Kasir dapat langsung menyentuh/mengklik di area mana saja pada kartu produk (gambar, nama, atau tombol `+`) untuk memasukkan item ke keranjang.
- **In-Cart Quantity Counter Badge**: Jika suatu menu telah dipilih, kartu produk otomatis menampilkan lencana real-time `✓ X di pesanan` disertai pendaran border warm amber, sehingga kasir tidak perlu berulang kali menoleh ke panel kanan.
- **Live Search Bar**: Kolom pencarian instan yang memfilter menu secara *real-time* berdasarkan nama dan deskripsi racikan.
- **Live Stock Indicator**:
  - Badge stok dinamis: *Tersedia*, *Stok Rendah* (≤ 5 item), dan *Habis*.
  - Produk yang habis otomatis dinonaktifkan (*disabled*) dengan label stempel `STOK HABIS`.
- **Ringkasan Stok Real-Time**: Sidebar menampilkan ringkasan Total Produk, Produk Stok Rendah, dan Produk Habis secara akurat.

### 2. 🧾 Panel Kasir & Keranjang Pesanan (Order Panel)
- **Data Pelanggan Fleksibel**:
  - Input `Nama Pelanggan`: Identifikasi pesanan (contoh: *Kak Rian*, *Meja 04*).
  - Input `Catatan Pesanan`: Detail kustomisasi barista (contoh: *Less ice, oat milk, take away*).
- **Kontrol Kuantitas Ergonomis**: Tombol stepper `[-]` `[qty]` `[+]` berukuran nyaman untuk layar sentuh tablet/laptop kasir.
- **Tombol Hapus Cepat (`✕`)**: Tombol hapus instan pada setiap item pesanan tanpa perlu menekan tombol minus berulang kali.
- **Kosongkan Pesanan**: Tombol reset keranjang yang dilengkapi dialog konfirmasi pencegahan klik tidak sengaja.
- **Rincian Pembayaran Jelas**: Subtotal, Jumlah Item (*Pcs*), dan Total Pembayaran ditampilkan dalam tipografi kontras tinggi.

### 3. 💳 Multi-Metode Pembayaran
- **💵 Tunai (Cash)**:
  - Input jumlah uang yang diterima dari pelanggan.
  - Opsi tombol pecahan uang pas cepat (Rp 20.000, Rp 50.000, Rp 100.000).
  - Kalkulasi uang kembalian otomatis secara presisi.
- **📱 QRIS Dinamis**:
  - Menampilkan QR Code QRIS resmi dengan kode pembayaran dinamis.
  - Dilengkapi simulasi verifikasi transfer dana masuk secara otomatis.
  - Efek suara lonceng (*chime audio*) saat dana berhasil masuk.
- **💳 Kartu Debit / EDC**:
  - Fasilitas pembayaran nontunai kartu bank/debit dengan konfirmasi nomor referensi gesek.

### 4. 🖨️ Struk Belanja Thermal Siap Cetak (Thermal Receipt)
- Format standar printer thermal kasir ukuran **80mm** dan **58mm**.
- Mencakup informasi lengkap:
  - Identitas Kedai Kisanak & Tahun Berdiri (Est. 2016)
  - Alamat kedai & nomor kontak
  - Kode Transaksi Unik (`KIS-YYYYMMDD-XXXX`)
  - Tanggal dan Jam Transaksi
  - Nama Kasir & Nama Pelanggan / Nomor Meja
  - Catatan khusus pelanggan
  - Daftar menu, kuantitas, harga satuan, dan subtotal
  - Metode pembayaran & total belanja
  - Pesan penutup hangat kedai kopi
- Terintegrasi langsung dengan dialog cetak browser (`window.print()`).

### 5. 📷 Scanner QR Code Terintegrasi
- Menggunakan pustaka *HTML5-QRCode* yang mengakses kamera perangkat secara aman (dengan izin *camera policy* di CSP).
- Berfungsi untuk membaca QR voucher diskon atau kartu keanggotaan pelanggan.

### 6. 📋 Riwayat Transaksi & Audit Integritas
- Menyimpan seluruh transaksi yang berhasil ke dalam **IndexedDB** lokal browser kasir.
- Dilengkapi penanda verifikasi integritas data anti-manipulasi.
- Format daftar urut mundur (transaksi terbaru di atas) lengkap dengan rincian jam, item, dan nominal.

### 7. 🔄 Reset Database & Mulai Shift Baru
- Tombol darurat/reset di header untuk mengembalikan stok produk ke konfigurasi awal dan membersihkan data pengujian.

---

## 🛡️ Arsitektur Keamanan (Cybersecurity Built-in)

Aplikasi ini telah melalui audit keamanan web tingkat tinggi untuk mencegah kebocoran informasi dan kecurangan transaksi:

| Lapisan Keamanan | Implementasi Teknis | Manfaat |
| :--- | :--- | :--- |
| **Anti-Tampering Price Vault** | `js/services/db.js` (`CANONICAL_PRICE_VAULT`) | Mencegah kasir/pengguna nakal memanipulasi harga melalui *Inspect Element (DevTools)*. Harga pesanan selalu dikalkulasi dari brankas memori internal, bukan dari atribut DOM HTML. |
| **Cryptographic Storage Integrity** | `js/utils/crypto.js` (`SubtleCrypto HMAC-SHA256`) | Data keranjang di `localStorage` dan riwayat transaksi di `IndexedDB` ditandatangani hash kriptografi. Jika data diedit manual, sistem mendeteksi kegagalan integritas dan mereset data yang rusak. |
| **XSS Prevention & Sanitization** | `js/utils/security.js` (`SecurityUtils.sanitize()`) | Semua data input (nama pembeli, catatan, query cari) disanitasi secara ketat sebelum dirender ke HTML. Mencegah injeksi kode berbahaya. |
| **Strict Content Security Policy (CSP)** | `netlify.toml` & `index.html` | Mengunci resource hanya dari origin sendiri dan CDN resmi terverifikasi. Zero `unsafe-inline` script. Memblokir MIME sniffing (`nosniff`) dan clickjacking (`DENY`). |
| **Zero Sensitive IP Leakage** | Seluruh codebase dibersihkan | Tidak ada tampilan IP publik terminal kasir di layar antarmuka pengguna untuk menjaga privasi jaringan kasir. |

---

## 📖 Panduan Operasional Kasir di Netlify

Berikut adalah Standar Operasional Prosedur (SOP) penggunaan web kasir Kedai Kisanak:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ 1. Buka Web POS │ ───► │ 2. Pilih Menu   │ ───► │ 3. Data Pembeli │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                           │
┌─────────────────┐      ┌─────────────────┐               ▼
│ 6. Struk / Nota │ ◄─── │ 5. Verifikasi   │ ◄─── ┌─────────────────┐
│    Tercetak     │      │    Pembayaran   │      │ 4. Metode Bayar │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Langkah 1: Membuka Sistem Kasir
1. Buka browser web (disarankan **Google Chrome**, **Microsoft Edge**, atau **Safari**).
2. Kunjungi tautan produksi: **[https://kedaikisanak.netlify.app](https://kedaikisanak.netlify.app)**.
3. Perhatikan indikator di samping nama kedai di header atas:
   - Harus bertanda `🟢 Kasir Siap` yang menandakan database IndexedDB lokal telah aktif.
   - Jam digital kasir akan berdetak sesuai waktu operasional lokal.

### Langkah 2: Memilih Menu & Filter Kategori
1. **Navigasi Kategori**: Klik tombol kategori di panel kiri (misalnya: *Espresso Based*, *Manual Brew*, *Non-Coffee*, atau *Pastry & Food*).
2. **Pencarian Cepat**: Ketik nama menu pada kolom pencarian di bagian atas katalog (misalnya ketik `"Latte"` atau `"Croissant"`).
3. **Memasukkan Menu ke Pesanan**:
   - Cukup **klik/sentuh kartu menu** atau tekan tombol **`+`**.
   - Setiap ketukan akan menambah kuantitas item sebanyak 1.
   - Perhatikan badge `✓ X di pesanan` yang muncul pada kartu sebagai konfirmasi visual.
   - Menu yang stoknya habis tidak dapat ditekan.

### Langkah 3: Mengatur Data Pesanan Pelanggan
1. Pada panel kanan (**🛒 Pesanan**):
   - Isi kolom **Nama Pelanggan** (contoh: `Kak Dimas` atau `Meja 07`).
   - Isi kolom **Catatan Pesanan** jika ada permintaan khusus (contoh: `Less sugar, extra hot`).
2. **Mengubah Jumlah Item**:
   - Tekan tombol **`+`** untuk menambah jumlah.
   - Tekan tombol **`−`** untuk mengurangi jumlah.
   - Tekan tombol **`✕`** merah di ujung kanan item jika ingin menghapus menu tersebut secara seketika.
3. Jika ingin membatalkan seluruh pesanan sekaligus, klik tombol **Kosongkan** di kanan atas panel pesanan, lalu konfirmasi **Ya, Kosongkan**.

### Langkah 4: Proses Pembayaran (Tunai, QRIS, Kartu)
Periksa ringkasan **Total Pembayaran** di bagian bawah, lalu pilih metode pembayaran yang diinginkan:

#### A. Pembayaran Tunai (Cash)
1. Klik tombol **💵 Tunai**.
2. Klik tombol besar **Proses Pesanan — Rp [Total]**.
3. Masukkan nominal uang yang diserahkan pelanggan pada kotak dialog, atau klik tombol pecahan cepat (Rp 20.000 / Rp 50.000 / Rp 100.000).
4. Sistem akan otomatis menampilkan nominal uang kembalian.
5. Klik **Konfirmasi Bayar**.

#### B. Pembayaran QRIS Dinamis
1. Klik tombol **📱 QRIS**.
2. Klik tombol besar **Proses Pesanan — Rp [Total]**.
3. Layar modal QRIS akan terbuka dan menampilkan QR code beresolusi tinggi dengan nominal transaksi pas.
4. Tunjukkan layar kepada pelanggan untuk di-scan melalui aplikasi e-wallet (GoPay, OVO, Dana, BCA, Livin', dll.).
5. Tunggu 3–5 detik; simulasi gateway pembayaran akan mendeteksi dana masuk secara otomatis, membunyikan notifikasi suara lonceng *chime*, dan menampilkan konfirmasi pembayaran sukses.

#### C. Pembayaran Kartu Debit / EDC
1. Klik tombol **💳 Kartu**.
2. Klik tombol besar **Proses Pesanan — Rp [Total]**.
3. Lakukan gesek/tap kartu pada mesin EDC fisik kasir.
4. Konfirmasi transaksi pada layar dialog POS.

### Langkah 5: Cetak Struk Belanja (Thermal Receipt)
1. Setelah pembayaran berhasil, akan muncul konfirmasi transaksi sukses dengan opsi:
   - **🖨️ Cetak Struk**: Langsung membuka jendela cetak printer thermal browser.
   - **Selesai / Transaksi Baru**: Menutup dialog dan mengosongkan keranjang untuk pelanggan berikutnya.
2. Jika terhubung dengan printer thermal 80mm/58mm via USB atau Bluetooth, struk akan tercetak dengan rapi dan presisi tanpa memuat elemen navigasi website.

### Langkah 6: Cek Riwayat & Audit Transaksi
1. Klik tombol **📋 Riwayat** pada header navigasi kanan atas.
2. Jendela riwayat akan menampilkan seluruh daftar pesanan yang pernah diproses pada terminal tersebut.
3. Kasir dapat melihat ID pesanan, nama pembeli, tanggal & jam presisi, daftar menu, metode bayar, dan total penerimaan.
4. Jika ada data lokal yang dicoba diubah lewat konsol browser, riwayat akan menampilkan label merah peringatan integritas data.

### Langkah 7: Fitur Scan QR Voucher / Meja
1. Klik tombol **📷 Scan QR** pada header navigasi.
2. Berikan izin akses kamera perangkat jika browser memintanya.
3. Arahkan kamera ke QR Code voucher diskon atau kartu keanggotaan pelanggan untuk membaca data secara instan.

### Langkah 8: Tutup Shift / Reset Database
1. Pada akhir shift atau saat pergantian kasir harian, jika ingin mengembalikan database stok ke angka default awal:
2. Klik tombol **🔄 Reset** pada header atas.
3. Masukkan konfirmasi pada pop-up SweetAlert.
4. Database IndexedDB produk akan di-*seed* ulang ke stok default dan transaksi lama dibersihkan.

---

## 🚀 Konfigurasi & Deployment di Netlify

Repositori ini telah dikonfigurasi secara *Zero-Config* untuk langsung di-*deploy* ke Netlify dengan performa optimal.

### File Konfigurasi Netlify:

#### 1. `netlify.toml`
File ini mengatur direktori publikasi, caching aset gambar statis selama 7 hari, dan header keamanan produksi:
```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(self), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://api.qrserver.com; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
```

#### 2. `_redirects`
Memastikan routing aplikasi statis tetap stabil saat kasir me-refresh halaman:
```
/*    /index.html   200
```

### Langkah Menghubungkan ke Akun Netlify Baru (Jika Perlu Deploy Ulang):
1. Buka dashboard [Netlify](https://app.netlify.com/).
2. Pilih **Add new site** > **Import an existing project**.
3. Pilih penyedia Git: **GitHub**.
4. Pilih repositori: `dawooodd/Kedai_kisanak`.
5. Pengaturan build:
   - **Branch to deploy**: `main`
   - **Build command**: *(kosongkan)*
   - **Publish directory**: `.` *(titik / root)*
6. Klik **Deploy site**.
7. Situs akan langsung aktif dalam hitungan detik dengan SSL HTTPS gratis.

---

## 💻 Menjalankan di Komputer Lokal (Local Development)

Karena aplikasi menggunakan **JavaScript ES6 Modules** (`import`/`export`), aplikasi harus dijalankan melalui server HTTP lokal (tidak bisa langsung double-click `file:///` karena aturan keamanan CORS browser).

### Cara 1: Menggunakan Ekstensi VS Code "Live Server" (Direkomendasikan)
1. Buka folder proyek di **Visual Studio Code**.
2. Pasang ekstensi **Live Server** (oleh Ritwick Dey) dari Extensions Marketplace.
3. Klik kanan pada file `index.html`, lalu pilih **Open with Live Server**.
4. Browser akan otomatis terbuka di `http://127.0.0.1:5500`.

### Cara 2: Menggunakan Node.js / NPX Serve
Jalankan perintah berikut di terminal:
```bash
npx -y serve . -l 5000
```
Buka browser di `http://localhost:5000`.

### Cara 3: Menggunakan Python
Jika komputer memiliki Python:
```bash
# Python 3
python -m http.server 8000
```
Buka browser di `http://localhost:8000`.

---

## 📁 Struktur Direktori Proyek

```
Kedai_kisanak/
├── index.html                   # Halaman antarmuka utama POS (Semantic HTML5)
├── netlify.toml                 # Konfigurasi deploy, caching & security headers Netlify
├── _redirects                   # Netlify fallback routing rule
├── README.md                    # Dokumentasi lengkap panduan aplikasi & SOP kasir
├── .gitignore                   # Konfigurasi ignore file Git
│
├── css/
│   └── style.css                # Master stylesheet (Coffee dark theme, tokens, responsive layout)
│
├── gambar/                      # Aset gambar menu & logo kedai
│   ├── logo_kisanak_modern.jpg  # Logo resmi modern Kedai Kisanak
│   ├── espresso.jpg             # Foto menu Espresso
│   ├── americano.jpg            # Foto menu Americano
│   ├── cafe_latte.jpg           # Foto menu Cafe Latte
│   ├── cappuccino.jpg           # Foto menu Cappuccino
│   ├── caramel_macchiato.jpg    # Foto menu Caramel Macchiato
│   ├── v60.jpg                  # Foto menu V60
│   ├── japanese_iced.jpg        # Foto menu Japanese Iced
│   ├── aeropress.jpg            # Foto menu Aeropress
│   ├── matcha_latte.jpg         # Foto menu Matcha Latte
│   ├── red_velvet.jpg           # Foto menu Red Velvet
│   ├── chocolate.jpg            # Foto menu Chocolate
│   ├── artisan_tea.jpg          # Foto menu Artisan Tea
│   └── *.svg                    # Ikon vektor menu pastry & food
│
└── js/                          # Arsitektur Modular ES6
    ├── main.js                  # Entry point aplikasi & event listener terpusat
    │
    ├── config/
    │   └── constants.js         # Master data produk, kategori, metode bayar & harga baku
    │
    ├── services/
    │   ├── db.js                # Layanan IndexedDB lokal & Canonical Price Vault (Anti-tamper)
    │   ├── storage.js           # Layanan LocalStorage dengan verifikasi tanda tangan kriptografi
    │   └── audio.js             # Generator efek audio chime pembayaran Web Audio API
    │
    ├── utils/
    │   ├── crypto.js            # Engine HMAC-SHA256 integritas data berbasis Web Crypto API
    │   ├── formatters.js        # Format mata uang Rupiah & format tanggal/jam Indonesia
    │   └── security.js          # Mesin sanitasi XSS (DOM Purifier & URL sanitizer)
    │
    └── components/
        ├── menu.js              # Komponen katalog produk, search bar, & in-cart badge
        ├── cart.js              # Komponen keranjang pesanan, stepper kuantitas, & total
        ├── payment.js           # Komponen modal QRIS, simulasi pembayaran, & scanner QR
        ├── history.js           # Komponen modal riwayat transaksi & indikator tamper alert
        └── receipt.js           # Generator struk thermal siap cetak (80mm/58mm)
```

---

## ⚙️ Spesifikasi Teknis

- **Bahasa**: JavaScript ES6+ (Native Modules, Strict Mode `"use strict";`)
- **Desain & Gaya**: Vanilla CSS3 (Custom Properties / Design Tokens, Flexbox, CSS Grid)
- **Tipografi**: `Playfair Display` (Serif elegan untuk judul & brand) dan `Inter` (Sans-serif untuk data & harga) via Google Fonts
- **Database Klien**: HTML5 IndexedDB API (Database `KedaiKisanakDB`, Stores: `products`, `transactions`)
- **Penyimpanan Status**: Web Storage API (`localStorage`) dengan checksum HMAC
- **Kriptografi**: W3C Web Crypto API (`window.crypto.subtle`)
- **Dukungan Printer**: Printer Thermal USB / Bluetooth POS (Standard ESC/POS via browser print driver)
- **Kompatibilitas Browser**:
  - Google Chrome 80+ (Desktop & Android)
  - Microsoft Edge 80+
  - Mozilla Firefox 75+
  - Apple Safari 13.1+ (macOS & iOS)

---

## ☕ Tentang Kedai Kisanak
*Kedai Kisanak didirikan pada tahun 2016 dengan semangat menyajikan kopi nusantara berkualitas specialty. Sistem POS ini dibangun dengan dedikasi penuh untuk menghadirkan kenyamanan bertransaksi bagi kasir, barista, dan para penikmat kopi sejati.*

**Dikelola dengan ❤️ oleh Tim Kedai Kisanak.**
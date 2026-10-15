# Laporan pengujian — VELOX Studio 2.0

Tanggal: **14 Oktober 2026**. Lingkungan: Linux, Node 20.20.2, Chromium melalui Playwright, yt-dlp 2026.08.19, ffmpeg terpasang.

## 1. Unit dan DOM

Perintah: `npm test`.

**69 tes lolos, 0 gagal.**

Cakupan bawaan: normalisasi, deteksi URL, cache, rate limit, resolver chain, provider, pemetaan error, aturan proxy, nama berkas, dan rendering frontend.

Tambahan Studio: tema/persistensi, pencarian platform, pilihan platform tanpa URL palsu, validasi URL, deteksi hostname, URL tanpa skema, filter format, keyboard API tabs, focus trap riwayat, pemulihan storage rusak, hapus/urungkan, pembatalan request, duplikasi request, escaping metadata, dan penolakan URL unduhan lintas origin.

**Perbaikan tes lama:** assertion chain TikTok pada arsip sumber masih mengharapkan `tikwm → engine`, padahal resolver sumber sudah berisi `tikwm → tiklydown → engine`. Assertion disesuaikan dengan implementasi yang sudah ada. Resolver TikTok tidak dihapus/diganti agar tes lolos.

## 2. Browser smoke test

Perintah: jalankan aplikasi, kemudian `npm run test:browser`.

Lolos di viewport: **320, 375, 390, 560, 640, 768, 1024, 1440 px**. Tidak ditemukan horizontal overflow pada halaman beranda di ukuran tersebut.

Skenario yang lolos:

- URL kosong dan skema yang tidak valid.
- Resolve → hasil → filter audio/video → unduhan berkas browser.
- Riwayat hasil, hapus semua, urungkan, tutup dengan Escape.
- Tema tersimpan setelah reload.
- Pencarian platform dan fokus input tanpa mengirim URL contoh.
- API tab, Home/arrow keyboard, tindakan salin contoh.
- FAQ accordion.
- Tampilan error upstream.
- Halaman 404 khusus.
- Preferensi reduced motion.
- Tidak ada uncaught page error.

**Penting:** resolve dan file download dalam browser smoke test menggunakan fixture yang ditandai jelas di kode. Unduhan fixture hanya memvalidasi alur UI/nama file, bukan keberhasilan server mengunduh media nyata. Tombol salin dijalankan; keberhasilan clipboard tetap tergantung izin browser.

## 3. Pemeriksaan aksesibilitas otomatis

Axe-core, tag WCAG 2 A/AA dan 2.1 AA:

- Beranda desktop tema gelap: **0 violation terdeteksi**.
- Beranda desktop tema terang: **0 violation terdeteksi**.
- Beranda mobile 390 px: **0 violation terdeteksi**.

Pemeriksaan otomatis bukan sertifikasi aksesibilitas penuh. Tidak semua kombinasi pembaca layar, status hasil, bahasa, atau browser telah diaudit manual.

## 4. Backend nyata, bukan fixture

Server lokal berjalan di `0.0.0.0:3000`.

- `/api/health`: **HTTP 200**, status `ok`, yt-dlp tersedia, ffmpeg aktif.
- `/api/platforms`, `/api/detect`, manifest, SVG, CSS, script tema, font: **HTTP 200**.
- `file:///etc/passwd` ke `/api/resolve`: **HTTP 400**, protokol ditolak.
- Satu link TikTok publik dari contoh project sumber:
  `https://www.tiktok.com/@tiktok/video/7460937381265411370`
  - Resolve: **HTTP 200**, provider `tikwm`.
  - 1 item, 4 pilihan format.
  - Unduhan video HD via `/api/dl`: **HTTP 200**, `video/mp4`.
  - **4.277.598 byte** selesai dibaca; header berkas mengandung MP4 `ftyp/isom`.
  - Media tidak disertakan dalam ZIP rilis.

Ini hanya membuktikan satu sumber berhasil pada saat pengujian. Tidak menjamin keberhasilan semua link TikTok atau 13 platform lain. Hasil upstream dapat berubah, memerlukan cookie, dibatasi wilayah, terkena rate limit, atau gagal dari IP hosting tertentu.

## 5. Batas verifikasi

- Suite `test:live` lama secara menyeluruh **tidak dijalankan**.
- Semua provider, playlist besar, carousel besar, dan konversi MP3 nyata **belum diuji menyeluruh**.
- Dockerfile dipertahankan; image Docker dan deployment publik **tidak dibangun/dijalankan** dalam pengujian ini.
- Safari, Firefox, perangkat iOS/Android fisik, dan clipboard lintas izin **belum diuji**.
- Belum ada load test, pentest menyeluruh, atau benchmark kinerja.
- Frontend menampung unduhan sebagai Blob: penggunaan RAM untuk file besar adalah batasan yang diwarisi.

## Menjalankan ulang

```bash
npm ci
npm test
npx playwright install --with-deps chromium
# Terminal 1:
npm start
# Terminal 2:
npm run test:browser
```

Set `VELOX_BASE_URL` jika server tidak berada di port 3000. Browser smoke test tidak membutuhkan konten pihak ketiga berhasil karena resolve/download diintersep sebagai fixture.

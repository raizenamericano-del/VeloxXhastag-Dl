# Laporan pengujian — VELOX Studio 2.2

**15 Oktober 2026.** Linux, Node **20.20.2**, Chromium via Playwright, yt-dlp **2026.08.19**, ffmpeg tersedia. Laporan 2.0/2.1 disimpan sebagai arsip terpisah.

## Ringkasan rilis

- `npm test`: **136 tes unit/DOM lolos, 0 gagal**.
- `npm run test:browser`: seluruh skenario smoke lolos; tidak ada uncaught page error.
- Beranda: tanpa horizontal overflow pada **320, 375, 390, 560, 640, 768, 1024, 1440 px**.
- Panel hasil + caption: tanpa overflow pada **320, 390, 768, 1440 px**.
- Axe-core WCAG 2 A/AA + 2.1 AA: **0 violation terdeteksi** pada halaman dengan hasil/caption dalam tema gelap/terang, dan beranda mobile. Motion dikurangi saat audit untuk menghindari pengukuran transisi warna di tengah animasi.
- Clipboard Chromium nyata menyalin deskripsi/baris baru/Unicode, semua hashtag dan satu hashtag; file `.txt` diunduh dan isinya dibandingkan dengan sumber fixture.
- `npm audit`: **0 kerentanan yang dilaporkan** pada dependency tree rilis. Ini bukan audit keamanan menyeluruh.
- `npm run verify:docker`: urutan install production, boot, health dan static assets lolos. Ini **bukan** build/run image Docker sungguhan.
- `/api/health`: 200, yt-dlp + ffmpeg tersedia, 19 platform.

## Regresi dan skenario baru

13 file resolver/engine lama dibandingkan SHA256 dengan rilis 2.1, termasuk TikTok, Instagram, YouTube. Snapshot normalizer membandingkan semua field lama dan URL format dengan hasil 2.1; metadata teks merupakan tambahan.

Cakupan fixture antara lain:

- Urutan adapter baru, toggle global/per-provider, jalur lama tetap sama.
- Caption asli, fallback judul, batas teks, Unicode/deduplikasi, URL fragment, tidak memakai keyword SEO sebagai hashtag.
- Escape textarea/atribut terhadap XSS; disabled state; clipboard API, execCommand, kegagalan manual tanpa sukses palsu.
- Signed Spotisaver POST + signature segar; JSON5 data-only menolak kode executable/header berbahaya.
- Parsing form SpotiDown/Spotimate; action-page placeholders ditolak; tidak mengirim jawaban CAPTCHA buatan.
- RapidSave input/host constraints; Bilibili `p=`, kualitas API aktual, label multipart.
- Validasi URL, DNS privat/campuran, redirect dan stripping secrets, sesi cookie terisolasi, batas respons.
- Tiket opaque, kedaluwarsa/cache, MIME dan HTML/JSON rejection, ukuran download dan invalidasi tiket gagal.
- Interaksi Studio lama: tema, riwayat/undo, filter platform/format, keyboard tab, validasi, download/error, 404, reduced motion.

**Browser resolve/download memakai fixture eksplisit.** Screenshot panel caption juga fixture, bukan bukti link tertentu menghasilkan konten tersebut. Test preview resmi positif memakai fixture, bukan credential developer nyata.

## Uji sumber nyata (terpisah dari fixture)

Tidak memakai credential Spotify developer atau cookie akun platform. File unduhan uji dibaca/diperiksa lalu dihapus, tidak dikemas dalam ZIP.

| Sumber / jalur | Hasil observasi |
|---|---|
| Spotify — Spotisaver | Track `4cOdK2wGLETKBW3PvgPWqT`: resolve **200**, judul “Never Gonna Give You Up”, artis Rick Astley. Gateway signed POST: **200**, `audio/mpeg`, **8.917.664 byte**, transfer selesai. ffprobe mengenali MP3, durasi sekitar **213,66 detik**. Ini file provider; identitas rekaman/orisinalitas/bitrate tidak dijamin. |
| Spotify — Spotimate | Adapter nyata menemukan **2 tautan media** (audio + cover). Unduhan penuh dari provider alternatif ini tidak diverifikasi. |
| Spotify — SpotiDown | Provider **menolak permintaan**. Tidak dinyatakan bekerja berdasarkan fixture. Jalur lain tetap tersedia. |
| Reddit — RapidSave | Post `90bu6w`: jalur Reddit publik gagal `UPSTREAM_BLOCKED`, lalu RapidSave resolve **200**. Gateway **200**, `video/mp4`, **14.613.355 byte**, transfer selesai; ffprobe H.264, **13,7 detik**, **tanpa stream audio** pada file ini. |
| Bilibili — direct API | `BV13x41117TL`: resolve **200**, kualitas API **720p**. Uji penuh ulang gateway: **200**, `video/mp4`, **88.439.189 byte**, transfer selesai; ffprobe MP4, sekitar **554,12 detik**. Probe awal tidak selesai; pengulangan penuh berhasil. |
| TikTok — jalur lama TikWM | Video `7460937381265411370`: resolve **200**, **4 format**, caption “Our response to the Supreme Court decision.”, `descriptionSource: caption`, hashtag kosong sesuai teks. File media TikTok tidak diunduh ulang dalam probe ini. |

Link lengkap uji: Spotify `https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`; Reddit `https://www.reddit.com/r/aww/comments/90bu6w/heat_index_was_110_degrees_so_we_offered_him_a/`; Bilibili `https://www.bilibili.com/video/BV13x41117TL`; TikTok `https://www.tiktok.com/@tiktok/video/7460937381265411370`.

Hasil adalah snapshot satu lingkungan, bukan jaminan provider selalu hidup atau konten selalu bisa diunduh. Resolusi link dan keberhasilan download dibedakan. Tidak ada bypass DRM, login atau CAPTCHA.

## Batas yang masih ada

- Semua 19 platform/link/format tidak diuji live ulang; IG/YT diuji lewat regresi dan kesamaan kode, bukan klaim sukses semua link nyata.
- Preview resmi Spotify dengan credential nyata, Spotimate full download, dan SpotiDown live sukses belum diverifikasi.
- Bluesky/Tumblr tidak diubah; hasil uji rilis sebelumnya ada di arsip 2.1, bukan dianggap uji baru.
- Safari/Firefox/perangkat fisik, stress test, multi-instance, audit keamanan menyeluruh, image Docker dan deploy hosting publik belum dilakukan.
- Tiket scrapr berada di memori proses: restart/multi-process tanpa routing yang konsisten dapat membuat tiket tidak tersedia.
- Metadata/caption mengikuti yang diberikan sumber. Provider tertentu hanya memberi judul singkat, bukan deskripsi lengkap.
- Frontend download menggunakan Blob, sehingga file besar menggunakan RAM browser. Jangan menafsirkan tombol batal resolve sebagai pembatalan setiap proses server.

## Jalankan ulang

```bash
npm ci
npm test
npx playwright install --with-deps chromium
# Terminal 1
npm start
# Terminal 2
npm run test:browser
node test/browser/caption.visual.cjs
npm audit
npm run verify:docker
```

Browser test menerima `VELOX_BASE_URL` (default `http://127.0.0.1:3000`). `npm run test:live` adalah suite legacy yang menghubungi upstream; bukan dasar jumlah 136 tes di atas. Gunakan konten yang berhak kamu akses/simpan untuk uji live.

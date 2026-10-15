# Laporan pengujian — VELOX Studio 2.1

Tanggal rilis: **15 Oktober 2026**. Lingkungan: Linux, Node 20.20.2, Chromium Playwright, yt-dlp 2026.08.19, ffmpeg tersedia. Laporan 2.0 disimpan terpisah di `TESTING-2.0.md`.

## Ringkasan

- `npm test`: **104 tes unit/DOM lolos, 0 gagal**.
- `npm run test:browser`: seluruh skenario smoke test lolos.
- Tidak ada horizontal overflow di viewport **320, 375, 390, 560, 640, 768, 1024, 1440 px** pada beranda yang diuji.
- Axe-core WCAG 2 A/AA + 2.1 AA: **0 violation terdeteksi** pada beranda desktop gelap, desktop terang, dan mobile 390 px.
- Tidak ada uncaught page error dalam skenario browser tersebut.
- `/api/health`: HTTP 200, status `ok`, 19 platform, yt-dlp serta ffmpeg tersedia.

Audit otomatis bukan sertifikasi aksesibilitas menyeluruh atau bukti semua browser/perangkat telah diuji.

## Pengujian tambahan 2.1

35 tes unit/DOM baru mencakup:

- Konsistensi 19 ID platform frontend/backend; canonical URL, short link, locale dan deteksi hostname.
- Isolasi Spotify dari engine/AIO/song-matching fallback.
- Metadata Spotify tanpa credential, preview resmi melalui fixture API, preview kosong, credential gagal, metadata album/playlist, dan source link yang aman.
- Tidak ada tombol unduhan audio ketika `formats` kosong.
- Filter platform Semua/Baru/Musik dan pencarian gabungan.
- Domain/path preview Spotify, batas ukuran respons, validasi redirect, dan token tidak diteruskan saat redirect.
- Reddit gallery dan video langsung yang tidak menjanjikan audio.
- Bluesky image post tanpa engine, external embed yang ditolak, dan kebutuhan engine untuk video HLS.
- CDN allowlist dan penolakan spoofed suffix.
- HTTP 412 dan remote disconnect tidak keliru dianggap ketiadaan media.

Skenario browser baru: filter 19/5/2 platform, kartu Spotify metadata-only tanpa download palsu, dan label PREVIEW yang jelas. Skenario v2.0 seperti tema, riwayat/undo, validasi, download browser, error state, keyboard API, FAQ, dan 404 tetap dijalankan.

**Penting:** respons resolve/download dalam browser smoke test merupakan fixture eksplisit. Preview audio Spotify positif juga diuji dengan fixture, bukan dengan credential nyata. Fixture tidak membuktikan suatu lagu nyata menyediakan preview.

## Uji sumber nyata

Credential Spotify developer tidak diisi; cookies platform juga tidak digunakan. Tidak ada media hasil uji yang dikemas dalam ZIP.

| Sumber | Contoh | Hasil pengujian |
|---|---|---|
| Spotify track | `open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT` | HTTP 200. Judul “Never Gonna Give You Up”, mode metadata, `previewStatus: not-configured`, 0 format audio. |
| Spotify album | `open.spotify.com/album/4yP0hdKOZPNshxUOjY0cZj` | HTTP 200. Judul “After Hours”, `collection-info`, 0 format audio. Tidak berpura-pura mengunduh koleksi. |
| Bluesky foto | `bsky.app/profile/bsky.app/post/3mxu3hsnebc2v` | HTTP 200, 1 format. File via backend selesai dibaca: **184.410 byte**, `image/webp`, nama berkas `.webp` sesuai MIME. |
| Reddit | `reddit.com/r/aww/comments/90bu6w/heat_index_was_110_degrees_so_we_offered_him_a/` | Jalur publik ditolak; fallback engine mendapat batas akses. API menampilkan `ACCESS_RESTRICTED` (HTTP 422). Belum berhasil diverifikasi untuk media nyata di server ini. |
| Tumblr | `maskofthedragon.tumblr.com/post/626907179849564160/mona-talking-in-english` | Sumber memutus koneksi; API menampilkan `NETWORK` (HTTP 422). Belum berhasil diverifikasi untuk media nyata di server ini. |
| Bilibili | `bilibili.com/video/BV13x41117TL` | Sumber memberi HTTP 412; API menampilkan `UPSTREAM_BLOCKED` (HTTP 422). Belum berhasil diverifikasi untuk media nyata di server ini. |

Hasil di atas adalah observasi satu lingkungan, bukan klaim status global. Memasang registri dan extractor tidak menjamin sumber mengizinkan download dari setiap IP, wilayah, atau akun. Tidak ada upaya bypass pembatasan akses/DRM.

## Belum diverifikasi secara langsung

- Preview Spotify dengan credential developer nyata; album/playlist penuh memang bukan fitur.
- Video Bluesky dan merge video/audio Reddit nyata.
- Keberhasilan media nyata Tumblr dan Bilibili dari lingkungan yang diizinkan sumber.
- Seluruh 19 platform untuk semua jenis link/kualitas; uji sumber lama penuh tidak diulang.
- Safari/Firefox, perangkat fisik iOS/Android, load test, dan audit keamanan menyeluruh.
- Image Docker dan deployment ke hosting publik.

Batasan warisan tetap berlaku: frontend memakai Blob untuk unduhan, sehingga berkas besar dapat menggunakan RAM tinggi. Tombol Batalkan menghentikan browser request, bukan jaminan seluruh proses server ikut berhenti.

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

Gunakan environment `VELOX_BASE_URL` untuk browser test jika server berada di port selain 3000. `npm run test:live` adalah suite lama yang menghubungi upstream; suite itu tidak dijadikan klaim kelulusan rilis 2.1.

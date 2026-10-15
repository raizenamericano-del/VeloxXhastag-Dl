# Changelog

## 2.2.0 — Scrapr & Keep the Context (2026-10-15)

- Adaptasi terpilih coflyn/scrapr: Spotisaver, SpotiDown, Spotimate, RapidSave, dan API Bilibili; pinned commit serta lisensi MIT disertakan.
- Resolver TikTok/Instagram/YouTube dan 10 file lama lain tetap identik dengan 2.1, diverifikasi hash. Jalur download dan field format lama dipertahankan.
- Gateway media bertiket, signature POST segar, public-address transport, timeout/batas ukuran, penolakan HTML/JSON palsu; tanpa eval kode remote atau token CAPTCHA buatan.
- Label audio provider dibedakan dari preview resmi, tanpa klaim bitrate. Info/preview resmi tetap cadangan dan koleksi tetap metadata.
- Panel caption: salin deskripsi, semua hashtag, hashtag satuan, ekspansi teks, simpan .txt, clipboard fallback/manual. Emoji, baris baru dan Unicode didukung; teks sumber di-escape.
- Tambahan metadata tanpa mengubah download formats; URL fragment/keyword SEO tidak dijadikan hashtag palsu.
- 136 unit/DOM tests, Chromium browser smoke, clipboard nyata, TXT download, dark/light axe dan screenshot fixture.
- Unduhan nyata Spotisaver MP3, RapidSave MP4 dan Bilibili MP4 selesai melalui backend; SpotiDown menolak saat probe. Rincian dan batasan di docs/TESTING.md.

## 2.1.0 — New Connections (2026-10-15)

- Menambah registri, ikon, deteksi hostname, serta backend untuk Spotify, Reddit, Bluesky, Tumblr, dan Bilibili. Total 19 integrasi.
- Spotify memakai oEmbed resmi untuk metadata lagu/album/playlist; optional client credentials untuk lookup preview track melalui API resmi. Hanya preview yang disediakan sumber yang menjadi format unduhan. Tidak ada konversi lagu penuh, lookup salinan alternatif, atau unduhan massal playlist.
- Spotify menampilkan status metadata-only/preview, penjelasan konfigurasi, dan tombol buka sumber yang divalidasi. Tidak lagi menganggap hasil tanpa audio sebagai “format ditemukan”.
- Reddit: foto/galeri/video lewat JSON publik; jalur video langsung berlabel kemungkinan tanpa audio dan opsi merge jika engine siap.
- Bluesky: foto lewat API publik dan video lewat engine, tanpa menyimpan playlist HLS sebagai MP4 palsu. Format file foto mengikuti tipe respons CDN.
- Tumblr/Bilibili: jalur extractor native yt-dlp, mengikuti batas akses sumber.
- Mengisolasi jalur lima platform baru dari fallback AIO universal; Spotify juga tidak menggunakan engine.
- Helper request baru memiliki timeout, batas ukuran respons, validasi domain setiap redirect, serta larangan meneruskan token saat redirect.
- Menambah filter platform Semua/Baru/Musik, badge baru, dan panel pengantar musik tanpa merombak desain yang disukai pengguna.
- Memperbaiki pemetaan HTTP 412 dan remote disconnect agar tidak salah disebut “tidak ada media”.
- Menambah 35 tes sehingga total unit/DOM menjadi 104, serta skenario browser Spotify metadata/preview dan filter integrasi.
- Lihat docs/TESTING.md untuk hasil nyata: metadata Spotify dan foto Bluesky berhasil; contoh sumber Reddit/Tumblr/Bilibili dibatasi atau terputus di lingkungan uji.

## 2.0.0 — Studio Edition (2026-10-14)

### Desain baru
- Menulis ulang struktur halaman, seluruh stylesheet, hero, navigasi, form, platform, bento fitur, tutorial, dokumentasi API, FAQ, footer, drawer, dan 404.
- Identitas charcoal/lime, tema terang, favicon baru, font lokal berlisensi, ilustrasi CSS/SVG, dan animasi responsif terhadap reduced motion.
- Copy utama berbahasa Indonesia dengan label editorial; menghapus klaim kecepatan/watermark yang tidak terjamin.

### Perilaku frontend
- Validasi URL HTTP(S), proteksi input kredensial/alamat lokal, deteksi hostname yang lebih tepat.
- Normalisasi URL tanpa skema, tombol hapus input, paste tanpa autosubmit.
- Kontrol request aktif, abort browser, timeout dua menit, dan indikator busy.
- Pencarian platform; kartu kini memilih konteks input, bukan mengirim sample URL.
- Filter format hasil dan penanganan thumbnail/metadata yang lebih aman.
- Unduhan hanya melalui endpoint same-origin `/api/dl`; menonaktifkan tombol unduh saat sibuk.
- Riwayat robust terhadap data storage rusak; undo hapus semua; pembaruan antar-tab; aksesibilitas modal.
- Theme persistence sebelum first paint, API keyboard tabs, copy snippet.

### Server dan tooling
- Engine/resolver asli tetap dipertahankan, termasuk tiklydown dari arsip pengguna.
- `.env` dibaca native saat server mulai, Node minimum 20.19.
- Manifest diselaraskan dengan identitas baru.
- Iframe preview hanya lewat opt-in `ALLOW_EMBED_PREVIEW=true`; default tetap SAMEORIGIN.
- Penambahan 12 tes DOM (total 69 unit/DOM) dan smoke test Playwright + axe-core.
- Assertion lama TikTok diperbaiki agar mengikuti resolver yang memang sudah ada di project sumber.
- Panduan instalasi, catatan batasan, laporan pengujian, dan screenshot lokal disertakan.

### Tetap menjadi batasan
- Provider pihak ketiga tidak dijamin selalu online.
- Pembatalan browser tidak menjamin seluruh pekerjaan server ikut berhenti.
- Download frontend menggunakan Blob dalam memori.
- Tidak ada klaim dukungan semua format/platform secara universal, bypass private content, atau offline downloader.

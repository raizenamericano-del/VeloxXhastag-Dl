> **Arsip rilis 2.1.** Untuk perilaku terbaru Spotify/Reddit/Bilibili, lihat [SCRAPR-2.2.md](SCRAPR-2.2.md).

# Platform baru — Studio 2.1

## Spotify: info dan cuplikan resmi, bukan downloader lagu penuh

### Tanpa konfigurasi tambahan

Tempel link lagu, album, atau playlist publik Spotify. Backend meminta metadata dari endpoint oEmbed resmi. UI menampilkan judul, cover jika tersedia, jenis konten, dan tombol **Buka Spotify**. HTML embed pihak ketiga tidak dirender atau dijalankan.

Hasil API dapat memuat:

```json
{
  "platform": "spotify",
  "metadataOnly": true,
  "availability": "metadata",
  "contentType": "track",
  "previewStatus": "not-configured",
  "items": [{ "formats": [] }]
}
```

Tidak ada file audio palsu dan tidak ada fallback ke penyedia lagu lain.

### Preview opsional

Set `SPOTIFY_CLIENT_ID` dan `SPOTIFY_CLIENT_SECRET` hanya di environment/`.env` backend. Ini credential aplikasi developer, **bukan username/password akun Spotify**. Aplikasi harus punya izin akses API yang sesuai. Restart server.

Backend memakai client-credentials grant ke Spotify, menyimpan access token sementara di memori, lalu meminta detail track melalui API resmi. Jika terdapat `preview_url` dari domain/path preview Spotify yang diizinkan, UI menampilkan **Preview resmi · MP3**, berlabel **PREVIEW** dan **bukan lagu penuh**.

Banyak lagu/aplikasi tidak menyediakan preview. Credential tidak menjamin keberhasilan. Jika lookup gagal atau nilainya kosong, tetap tampilkan metadata tanpa tombol audio. Durasi lagu penuh pada metadata tidak sama dengan durasi cuplikan.

Nilai `previewStatus`: `available`, `not-configured`, `not-provided`, `api-unavailable`, atau `collection-info`.

### Link yang didukung

- `https://open.spotify.com/track/<22-karakter-id>`
- `https://open.spotify.com/album/<22-karakter-id>`
- `https://open.spotify.com/playlist/<22-karakter-id>`
- Bentuk `/intl-id/track/...`, `/embed/track/...`, dan query tracking akan dinormalisasi.
- `spotify.link/...` dan `spoti.fi/...` hanya diikuti jika seluruh redirect tetap berada pada domain Spotify yang diizinkan. Short link yang memakai perantara lain dapat ditolak; gunakan link `open.spotify.com` sebagai alternatif.
- Link artis, podcast/episode, beranda, URI `spotify:...`, dan konten privat belum didukung.

Album/playlist hanya metadata koleksi. Tidak mengambil daftar semua track, tidak ZIP playlist, tidak melewati DRM, dan tidak mencari file lagu pengganti di platform lain.

## Reddit

- Link post `/r/<komunitas>/comments/<id>/...`, `/user/<nama>/comments/<id>/...`, `/comments/<id>/...`, galeri `/gallery/<id>`, dan `redd.it/<id>`.
- Jalur utama: JSON post publik dengan URL media yang dibatasi ke CDN Reddit.
- Foto/galeri menjadi file terpisah.
- Video langsung sering tidak memiliki audio. Labelnya menyebut batasan ini.
- Opsi **Video + audio** memerlukan yt-dlp dan ffmpeg; tinggi merge dibatasi konfigurasi `MAX_MERGE_HEIGHT`.
- Jika jalur JSON gagal, coba extractor Reddit yt-dlp. Tidak mengirim ke fallback AIO universal.
- Reddit dapat memblokir IP hosting, meminta sesi, atau menolak akses. Post teks/tautan eksternal tidak dijamin memiliki media yang didukung.

## Bluesky

- Gunakan `https://bsky.app/profile/<handle-atau-DID>/post/<rkey>`.
- Handle di-resolve melalui API publik, lalu post dibaca melalui `getPosts`.
- Foto penuh diambil dari CDN Bluesky; ekstensi file mengikuti MIME respons CDN, misalnya JPEG/WebP.
- Video HLS diproses lewat yt-dlp, bukan menyimpan teks `.m3u8` sebagai berkas `.mp4`. ffmpeg dapat diperlukan.
- Mendukung media dalam `recordWithMedia`; kutipan post tanpa media milik post itu sendiri tidak otomatis diunduh.
- Feed profil, post teks, dan tautan eksternal saja bukan target media.

## Tumblr

- Video/audio publik dari link post Tumblr yang didukung extractor yt-dlp.
- Foto-only post, halaman blog umum, dan dashboard-only post tidak dijamin bekerja.
- Tidak ada API key Tumblr tambahan; yt-dlp harus terpasang dan diperbarui.
- Sumber dapat menolak koneksi dari hosting tertentu. Kegagalan tidak diganti dengan media palsu.

## Bilibili

- Link video `bilibili.com/video/...` dan short link `b23.tv/...` dikenali.
- Menggunakan extractor Bilibili di yt-dlp; ffmpeg mungkin diperlukan untuk video/audio terpisah.
- Tidak menjanjikan konten premium, region-locked, kualitas yang memerlukan login, koleksi penuh, atau live stream.
- HTTP 412 dari sumber dilaporkan sebagai penolakan akses, bukan seolah-olah kontennya tidak punya video.

## Sumber lama

14 integrasi Studio 2.0 tetap ada. Registri backend berjumlah 19, sama dengan registri frontend. `/api/platforms` kini juga menyertakan `mode` dan `limitation` untuk menjelaskan perbedaan kemampuan sumber.

Selalu unduh media yang kamu miliki atau punya izin untuk disimpan. Akses publik tidak menghapus hak cipta atau ketentuan platform.

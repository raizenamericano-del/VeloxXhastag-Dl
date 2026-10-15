# Studio 2.2 — integrasi scrapr dan metadata teks

## Ruang lingkup

Hanya tiga platform memakai adapter scrapr. Urutan Spotify: `scrapr-spotisaver`, `scrapr-spotidown`, `scrapr-spotmate`, `spotify-official`. Reddit: `reddit-public`, `scrapr-rapidsave`, `engine`. Bilibili: `scrapr-bilibili`, `engine`. Circuit breaker engine lama tetap berlaku. Spotify tidak memakai fallback yt-dlp/AIO universal.

TikTok/Instagram/YouTube dan modul resolver lama yang dilindungi tidak diedit. Baseline SHA256 terdapat di `protected-resolvers-v2.1.json`. Snapshot normalizer memastikan field/format lama tetap sama; field teks ditambahkan terpisah.

### Spotify

- Provider hanya mencoba **track tunggal**. Album/playlist tetap metadata resmi, bukan bulk-download.
- Audio provider bukan preview resmi dan tidak dijamin rekaman asli Spotify. Tidak ada janji bitrate, kualitas, durasi atau kecocokan rekaman.
- Provider dapat gagal saat resolve atau saat download. Resolve yang berhasil belum membuktikan file bisa diunduh.
- Jika semua adapter gagal saat resolve, info/preview resmi tetap dicoba. Credential API Spotify hanya untuk jalur preview resmi opsional.
- SpotiDown tidak dikirimi jawaban CAPTCHA palsu. Tidak ada bypass challenge.

### Reddit / Bilibili

RapidSave dipakai setelah jalur Reddit publik gagal. Video sumber bisa tanpa audio; label tidak menjanjikan audio gabungan. Bilibili direct memakai video mainland BV/AV, mendukung halaman `p=`, dan memakai kualitas yang benar-benar dikembalikan API. Segmen `durl` yang lebih dari satu diberi label bagian terpisah, tidak digabung oleh adapter. Konten internasional/region/login mengikuti dukungan engine cadangan dan batas sumber, bukan klaim cakupan penuh.

## Gateway media

Format hasil mengarah ke `/api/dl?t=scrapr&ticket=...`, bukan mempublikasikan cookie, signature, atau body POST provider.

- Tiket acak 192-bit; maksimum 4.000 tiket dalam memori proses.
- TTL adalah maksimum 15 menit atau TTL cache + 60 detik. Cache dengan tiket mati dilewati.
- Restart menghapus tiket. **Multi-process/multi-instance perlu sticky routing ke proses yang sama atau implementasi shared ticket store tambahan.** Shared store belum tersedia.
- Download gagal menghapus tiket; resolve ulang sebelum mencoba lagi. Tidak ada retry ke provider berikutnya di tengah stream.
- HTTPS, validasi DNS publik pada koneksi, batas redirect, penghapusan header rahasia lintas origin, batas file, dan timeout diterapkan pada adapter baru.
- Respons HTML/JSON dan MIME yang tidak sesuai ditolak; ekstensi mengikuti jenis file yang diterima. Ini validasi dasar, bukan jaminan autentisitas file.
- Signed Spotisaver POST disiapkan ulang saat download, bukan disederhanakan menjadi GET.
- Konfigurasi `ALLOW_DIRECT_PROXY=false` juga menonaktifkan gateway scrapr.

Transport baru ini **tidak berarti seluruh jalur proxy lama sudah diaudit atau dirombak**. Adapter mengakses layanan pihak ketiga; URL sumber dikirim ke provider terkait.

## Konfigurasi

| Environment | Default | Makna |
|---|---|---|
| `SCRAPR_ENABLED` | `true` | `false` mematikan semua adapter baru, mempertahankan copy caption. |
| `SCRAPR_DISABLED` | kosong | Daftar nama dipisahkan koma: `spotisaver,spotidown,spotmate,rapidsave,bilibili`. |
| `SCRAPR_TIMEOUT_SECONDS` | `12` | Batas per provider, dijepit 3–20 detik; budget dispatcher keseluruhan tetap berlaku. |
| `SCRAPR_MAX_DOWNLOAD_MB` | `128` | Batas khusus download scrapr, satuan MiB, dijepit 1–512. |

Gateway memakai batas waktu download 180 detik. Timeout 120 detik di browser berlaku untuk resolve, bukan seluruh transfer file. Node minimum 20.19 sesuai engine project/dependensi baru. Restart server setelah mengubah konfigurasi.

## Caption & hashtag

Respons resolve mendapatkan field tambahan:

```json
{
  "description": "Cerita dari sumber 🌿\n#Pati #CeritaHariIni",
  "descriptionSource": "caption",
  "descriptionTruncated": false,
  "hashtags": ["#Pati", "#CeritaHariIni"]
}
```

- TikWM/Tiklydown: teks yang sudah dikembalikan resolver lama dipakai sebagai caption; isi downloader tidak diubah.
- Engine: `info.description` diprioritaskan, lalu judul lengkap yang tersedia.
- Normalizer provider umum: menyimpan teks sebelum pemendekan judul; bila provider hanya memasok judul, UI menyebutnya teks singkat.
- Tidak mengambil ulang halaman sumber demi caption, tidak membuat teks atau hashtag secara generatif, dan tidak mengubah keyword/tag SEO biasa menjadi hashtag.
- Unicode, emoji, baris baru didukung. Hashtag eksplisit/di dalam teks dideduplikasi; URL fragment tidak dianggap hashtag.
- Batas teks 50.000 unit UTF-16, 100 hashtag, 200 unit per hashtag. Teks terlalu panjang diberi tanda. Kapasitas ini bukan janji bahwa sumber selalu memberi deskripsi lengkap.
- Teks di-escape saat render. Tidak ada parsing caption sebagai HTML.
- Tombol salin deskripsi, salin semua hashtag, hashtag satuan, perluas teks, dan simpan `.txt`. Spotify tidak menampilkan panel caption buatan dari judul lagu.
- Clipboard API → `execCommand` fallback → petunjuk salin manual dari textarea/input readonly; kegagalan tidak dinyatakan berhasil.

## Menguji

`npm test`, `npm run test:browser` (server harus aktif), dan `node test/browser/caption.visual.cjs` untuk screenshot fixture. Lihat [TESTING.md](TESTING.md) untuk memisahkan hasil fixture dan unduhan sumber nyata.

'use strict';

// Official metadata and optional official preview only. This resolver is
// official fallback: adapted third-party providers are composed separately in the dispatcher.
const config = require('../config');
const { publicRequest, allowed } = require('../lib/public-fetch');
const { AppError } = require('../lib/errors');
const { dlDirect, slugify, cleanTitle, humanDuration } = require('./normalize');
let cachedToken = null;
let tokenPromise = null;

function parseSpotifyUrl(input) {
  const u = new URL(input);
  if (!allowed(u.href, ['open.spotify.com'])) throw new AppError('INVALID_URL', { status: 400, title: 'Gunakan link Spotify resmi', message: 'Salin link lagu, album, atau playlist dari open.spotify.com.' });
  const match = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist)\/([A-Za-z0-9]{22})\/?$/i);
  if (!match) throw new AppError('UNSUPPORTED_SPOTIFY_LINK', { status: 400, title: 'Jenis link Spotify belum didukung', message: 'Gunakan link lagu, album, atau playlist. Link artis, episode, dan beranda belum didukung.' });
  return { type: match[1].toLowerCase(), id: match[2], url: `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}` };
}
function previewAllowed(url) {
  return allowed(url, ['p.scdn.co']) && new URL(url).pathname.startsWith('/mp3-preview/');
}
async function accessToken() {
  const key = `${config.spotifyClientId}:${config.spotifyClientSecret}`;
  if (cachedToken?.key === key && cachedToken.expires > Date.now()) return cachedToken.token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const result = await publicRequest('https://accounts.spotify.com/api/token', {
      hosts: ['accounts.spotify.com'], method: 'POST',
      headers: { authorization: 'Basic ' + Buffer.from(key).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!result.access_token) throw new Error('Spotify did not issue an access token');
    cachedToken = { key, token: result.access_token, expires: Date.now() + Math.max(0, (Number(result.expires_in) || 3600) - 60) * 1000 };
    return cachedToken.token;
  })();
  try { return await tokenPromise; } finally { tokenPromise = null; }
}
async function viaSpotify(ctx) {
  let input = ctx.url;
  if (['spotify.link', 'spoti.fi'].includes(input.hostname)) {
    input = await publicRequest(input.href, { hosts: ['spotify.link', 'spoti.fi', 'open.spotify.com'], mode: 'url', signal: ctx.signal });
  }
  const link = parseSpotifyUrl(input.href);
  let embed = null, track = null, metadataError = null;
  let previewStatus = link.type !== 'track' ? 'collection-info' : !config.spotifyClientId || !config.spotifyClientSecret ? 'not-configured' : 'not-provided';
  const warnings = [{ text: 'Jalur resmi Spotify hanya menampilkan info dan preview resmi jika tersedia. Bukan unduhan lagu penuh atau konversi playlist ke MP3.' }];
  try {
    embed = await publicRequest(`https://open.spotify.com/oembed?url=${encodeURIComponent(link.url)}`, { hosts: ['open.spotify.com'], signal: ctx.signal });
  } catch (err) { metadataError = err; }
  if (link.type === 'track' && config.spotifyClientId && config.spotifyClientSecret) {
    try {
      const token = await accessToken();
      track = await publicRequest(`https://api.spotify.com/v1/tracks/${link.id}`, { hosts: ['api.spotify.com'], signal: ctx.signal, headers: { authorization: `Bearer ${token}` } });
    } catch (err) {
      previewStatus = 'api-unavailable';
      if (err.status === 401) cachedToken = null;
      warnings.push({ text: 'Akses preview melalui API Spotify belum tersedia saat ini. Informasi publik tetap ditampilkan jika dapat diakses.' });
    }
  }
  if (!embed?.title && !track?.name) throw new AppError(metadataError?.status === 404 ? 'NOT_FOUND' : 'SPOTIFY_UNAVAILABLE', {
    status: metadataError?.status === 404 ? 404 : 503,
    title: 'Info Spotify belum bisa diambil', message: 'Link mungkin tidak tersedia, bersifat privat, atau Spotify sedang membatasi akses dari server ini.',
    hint: 'Buka link di Spotify untuk memastikannya masih tersedia, lalu coba lagi.',
  });
  const title = cleanTitle(track?.name || embed.title);
  const thumbnail = track?.album?.images?.[0]?.url || embed?.thumbnail_url || null;
  const author = track?.artists?.map(a => a.name).filter(Boolean).join(', ') || null;
  const formats = [];
  if (typeof track?.preview_url === 'string' && previewAllowed(track.preview_url)) {
    formats.push({ id: 'spotify-preview', kind: 'audio', ext: 'mp3', tag: 'PREVIEW', label: 'Preview resmi · MP3',
      note: 'Cuplikan pendek, bukan lagu penuh', url: dlDirect(track.preview_url, { filename: `${slugify(title)}-preview`, ext: 'mp3' }) });
  }
  const availability = formats.length ? 'preview' : 'metadata';
  if (link.type !== 'track') warnings.push({ text: 'Album/playlist ditampilkan sebagai info koleksi. Daftar lagu dan unduhan massal tidak diambil.' });
  return {
    platform: 'spotify', platformName: 'Spotify', url: link.url, sourceUrl: link.url,
    title, author, thumbnail, duration: track?.duration_ms ? humanDuration(track.duration_ms / 1000) : null,
    kind: 'audio', isPlaylist: false, metadataOnly: !formats.length, availability, contentType: link.type, previewStatus: formats.length ? 'available' : previewStatus,
    notice: formats.length ? 'Preview resmi tersedia. Durasi cuplikan berbeda dari durasi lagu penuh.' : previewStatus === 'not-configured' ? 'Preview audio tidak tersedia di server ini: akses API Spotify belum dikonfigurasi. Informasi publik tetap bisa dilihat; lagu penuh tidak disediakan.' : previewStatus === 'collection-info' ? 'Ini informasi koleksi Spotify, bukan daftar unduhan. Buka sumber untuk melihat album atau playlist lengkap.' : previewStatus === 'api-unavailable' ? 'Preview belum bisa diperiksa karena akses API Spotify sedang tidak tersedia. Informasi publik tetap bisa dilihat.' : 'Spotify tidak menyediakan preview yang dapat digunakan untuk track ini. Kamu tetap bisa membuka sumber di Spotify.',
    items: [{ id: link.id, title, kind: 'audio', formats }], warnings,
  };
}
module.exports = { id: 'spotify', name: 'Spotify', exclusive: true, methods: [{ name: 'spotify-official', run: viaSpotify }], parseSpotifyUrl, previewAllowed,
  _clearToken: () => { cachedToken = null; tokenPromise = null; } };

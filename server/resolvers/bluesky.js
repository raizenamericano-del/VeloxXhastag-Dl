'use strict';
const { publicRequest, allowed } = require('../lib/public-fetch');
const { AppError } = require('../lib/errors');
const { dlDirect, dlEngine, cleanTitle, slugify } = require('./normalize');
const engine = require('../lib/ytdlp');
const config = require('../config');

function parsePost(input) {
  const u = new URL(input);
  const m = u.pathname.match(/^\/profile\/([^/]+)\/post\/([a-zA-Z0-9]+)\/?$/);
  if (!allowed(u.href, ['bsky.app']) || !m) throw new AppError('INVALID_URL', { status: 400, title: 'Gunakan link post Bluesky', message: 'Contoh bentuk link: https://bsky.app/profile/handle/post/id' });
  let actor;
  try { actor = decodeURIComponent(m[1]); } catch { throw new Error('Invalid Bluesky handle'); }
  if (!/^(?:did:(?:plc|web):[a-zA-Z0-9.:%-]+|[a-zA-Z0-9.-]+)$/.test(actor)) throw new Error('Invalid Bluesky handle');
  return { actor, rkey: m[2], url: `https://bsky.app/profile/${encodeURIComponent(actor)}/post/${m[2]}` };
}
async function viaPublicApi(ctx) {
  const p = parsePost(ctx.url.href);
  const options = { hosts: ['public.api.bsky.app'], signal: ctx.signal };
  let did = p.actor;
  if (!did.startsWith('did:')) {
    const actor = await publicRequest(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(p.actor)}`, options);
    did = actor.did;
  }
  if (typeof did !== 'string' || !/^did:(plc|web):[a-zA-Z0-9.:%-]+$/.test(did)) throw new Error('Bluesky profile not found');
  const uri = `at://${did}/app.bsky.feed.post/${p.rkey}`;
  const result = await publicRequest(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`, options);
  const post = result.posts?.[0];
  if (!post) throw new AppError('NOT_FOUND', { status: 404, title: 'Post Bluesky tidak ditemukan', message: 'Post mungkin dihapus atau tidak dapat diakses publik.' });
  const title = cleanTitle(post.record?.text) || 'Media Bluesky';
  const author = post.author?.displayName || post.author?.handle || p.actor;
  const embed = post.embed?.media || post.embed;
  const images = (embed?.images || []).filter(i => allowed(i.fullsize, ['cdn.bsky.app']));
  const items = images.map((image, i) => ({ id: String(i + 1), title, thumbnail: image.thumb || image.fullsize, kind: 'image', formats: [
    { id: `image-${i + 1}`, label: `Foto ${i + 1} · Resolusi penuh`, tag: 'FOTO', kind: 'image', note: 'Format mengikuti CDN (JPEG/WebP)',
      url: dlDirect(image.fullsize, { filename: `${slugify(title)}-${i + 1}` }) },
  ] }));
  if (embed?.playlist && allowed(embed.playlist, ['video.bsky.app'])) {
    if (!engine.isAvailable()) throw new AppError('ENGINE_MISSING', { status: 503, title: 'Video Bluesky memerlukan engine', message: 'Pasang yt-dlp untuk mengunduh video HLS Bluesky sebagai file media. Foto publik tidak memerlukan engine.' });
    items.push({ id: 'video', title, thumbnail: embed.thumbnail || null, kind: 'video', formats: [
      { id: 'video', label: 'Video · MP4', tag: 'VIDEO', kind: 'video', ext: 'mp4', note: 'Disiapkan lewat yt-dlp; ffmpeg mungkin diperlukan',
        url: dlEngine(p.url, { filename: slugify(title), format: `bv*[height<=${config.maxMergeHeight}]+ba/b[height<=${config.maxMergeHeight}]`, ext: 'mp4' }) },
    ] });
  }
  if (!items.length) throw new AppError('NO_MEDIA', { status: 422, title: 'Post ini belum punya media yang didukung', message: 'Gunakan post Bluesky berisi foto atau video, bukan hanya teks atau tautan eksternal.' });
  return { platform: 'bluesky', platformName: 'Bluesky', url: p.url, title, author,
    thumbnail: items[0].thumbnail, kind: images.length ? 'gallery' : 'video', isPlaylist: false,
    items, warnings: [], likes: post.likeCount || null };
}
module.exports = { id: 'bluesky', name: 'Bluesky', exclusive: true, methods: [{ name: 'bluesky-public', run: viaPublicApi }, { name: 'engine' }], parsePost };

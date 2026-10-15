'use strict';
const { publicRequest, allowed } = require('../lib/public-fetch');
const { AppError } = require('../lib/errors');
const { dlDirect, dlEngine, cleanTitle, slugify, humanDuration } = require('./normalize');
const engine = require('../lib/ytdlp');
const config = require('../config');

function postId(input) {
  const u = new URL(input);
  if (!allowed(u.href, ['reddit.com', 'redd.it'])) return null;
  const m = u.hostname === 'redd.it' ? u.pathname.match(/^\/([a-z0-9]+)\/?$/i) : u.pathname.match(/^\/(?:(?:r|user)\/[^/]+\/)?comments\/([a-z0-9]+)/i) || u.pathname.match(/^\/gallery\/([a-z0-9]+)/i);
  return m?.[1] || null;
}
async function viaPublicJson(ctx) {
  let url = ctx.url;
  if (!postId(url.href) && /\/s\//.test(url.pathname)) url = await publicRequest(url.href, { hosts: ['reddit.com', 'redd.it'], mode: 'url', signal: ctx.signal });
  const id = postId(url.href);
  if (!id) throw new AppError('INVALID_URL', { status: 400, title: 'Gunakan link post Reddit', message: 'Salin link post atau galeri Reddit, bukan halaman komunitas.' });
  const json = await publicRequest(`https://www.reddit.com/comments/${id}.json?raw_json=1`, { hosts: ['reddit.com'], signal: ctx.signal });
  const original = json?.[0]?.data?.children?.[0]?.data;
  if (!original || original.removed_by_category) throw new AppError('NOT_FOUND', { status: 404, title: 'Post Reddit tidak tersedia', message: 'Post mungkin dihapus, privat, atau dibatasi oleh Reddit.' });
  const post = original.crosspost_parent_list?.[0] || original;
  const title = cleanTitle(original.title) || 'Media Reddit';
  const pageUrl = `https://www.reddit.com/comments/${id}/`;
  const items = [], warnings = [];
  const addImage = (src, index) => {
    if (!allowed(src, ['i.redd.it', 'preview.redd.it'])) return;
    const path = new URL(src).pathname;
    const ext = /\.png$/i.test(path) ? 'png' : /\.gif$/i.test(path) ? 'gif' : /\.webp$/i.test(path) ? 'webp' : 'jpg';
    items.push({ id: `image-${index}`, title, thumbnail: src, kind: 'image', formats: [{ id: `image-${index}`, kind: 'image', ext, tag: 'FOTO', label: `Foto ${index} · ${ext.toUpperCase()}`, url: dlDirect(src, { filename: `${slugify(title)}-${index}`, ext }) }] });
  };
  if (post.gallery_data?.items) {
    post.gallery_data.items.forEach((item, i) => { const media = post.media_metadata?.[item.media_id]; if (media?.status === 'valid') addImage(media.s?.u || media.s?.gif, i + 1); });
  } else addImage(post.url_overridden_by_dest || post.url, 1);
  const video = post.secure_media?.reddit_video || post.media?.reddit_video;
  if (video?.fallback_url && allowed(video.fallback_url, ['v.redd.it'])) {
    const formats = [];
    if (engine.isAvailable() && engine.hasFfmpeg()) formats.push({ id: 'merged', label: 'Video + audio · MP4', tag: 'MERGE', kind: 'video', ext: 'mp4', note: 'Audio mengikuti sumber; diproses yt-dlp + ffmpeg', url: dlEngine(pageUrl, { format: `bv*[height<=${config.maxMergeHeight}]+ba/b[height<=${config.maxMergeHeight}]`, filename: slugify(title), ext: 'mp4' }) });
    formats.push({ id: 'direct', label: 'Video langsung · MP4', tag: 'VIDEO', kind: 'video', ext: 'mp4', note: 'Jalur video saja; suara tidak dijamin', url: dlDirect(video.fallback_url, { filename: slugify(title), ext: 'mp4' }) });
    warnings.push({ text: 'Reddit sering memisahkan suara dan video. Pilih Video + audio jika tersedia; jalur video langsung dapat tanpa suara.' });
    items.push({ id: 'video', title, kind: 'video', duration: humanDuration(video.duration), formats });
  }
  if (!items.length) throw new AppError('NO_MEDIA', { status: 422, title: 'Tidak ada media Reddit yang cocok', message: 'Gunakan post dengan video, foto, atau galeri Reddit publik. Post teks dan tautan eksternal bisa tidak didukung.' });
  return { platform: 'reddit', platformName: 'Reddit', url: pageUrl, title, author: original.author ? `u/${original.author}` : null,
    thumbnail: items.find(i => i.thumbnail)?.thumbnail || (allowed(post.thumbnail, ['redditmedia.com', 'redd.it']) ? post.thumbnail : null),
    duration: humanDuration(video?.duration), kind: video ? 'video' : 'gallery', isPlaylist: false, items, warnings };
}
module.exports = { id: 'reddit', name: 'Reddit', exclusive: true, methods: [{ name: 'reddit-public', run: viaPublicJson }, { name: 'engine' }], postId };

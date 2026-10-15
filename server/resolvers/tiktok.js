'use strict';

const config = require('../config');
const { getJson } = require('../lib/http');
const { dlDirect, dlEngine, humanDuration, fmtSize, slugify } = require('./normalize');

/**
 * TikTok — improved fast path with dual fallback API providers:
 * 1. TikWM primary (no key, no watermark, HD + photo slides + music)
 * 2. Secondary TikTok API fallback for redundancy
 * 3. yt-dlp engine fallback as last resort
 */

const TIKTOK_FALLBACK_BASE = 'https://api.tiklydown.eu.org';

const abs = (u) => {
  if (!u) return null;
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `${config.tikwmBase}${u}`;
  return u;
};

async function viaTikwm(ctx) {
  const body = new URLSearchParams({ url: ctx.url.href, hd: '1' });
  const json = await getJson(`${config.tikwmBase}/api/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: config.tikwmBase, referer: `${config.tikwmBase}/` },
    body,
    timeoutMs: 20_000,
    retries: 2,
  });

  if (json.code !== 0 || !json.data) throw new Error(json.msg || 'tikwm returned no data');
  const d = json.data;
  const title = String(d.title || d.desc || 'TikTok video').replace(/<[^>]*>/g, '').trim();
  const base = slugify(title);
  const author = d.author ? `${d.author.nickname || ''}${d.author.unique_id ? ` (@${d.author.unique_id})` : ''}`.trim() : null;
  const thumbnail = abs(d.origin_cover || d.cover || d.dynamic_cover);

  // Photo slide / carousel post
  if (Array.isArray(d.images) && d.images.length) {
    return {
      platform: 'tiktok', platformName: 'TikTok', url: ctx.url.href,
      title, author, thumbnail,
      duration: humanDuration(d.duration),
      kind: 'gallery', isPlaylist: false,
      items: [{
        id: d.id || base,
        title, thumbnail,
        duration: humanDuration(d.duration),
        kind: 'gallery',
        formats: d.images.map((img, i) => ({
          id: `img-${i + 1}`,
          label: `Photo ${i + 1}/${d.images.length}`,
          tag: 'IMG',
          ext: 'jpg',
          kind: 'image',
          url: dlDirect(abs(img), { referer: 'https://www.tiktok.com/', filename: `${base}-${i + 1}` }),
        })).concat(
          d.music
            ? [{ id: 'music', label: 'Sound · MP3', tag: 'MP3', ext: 'mp3', kind: 'audio', url: dlDirect(abs(d.music), { referer: 'https://www.tiktok.com/', filename: `${base}-sound` }) }]
            : [],
        ),
      }],
      warnings: [],
    };
  }

  const play = abs(d.play);           // no watermark, compressed
  const hd = abs(d.hdplay);           // no watermark, HD
  const wm = abs(d.wmplay);           // with watermark
  const formats = [];

  if (hd) formats.push({ id: 'hd', label: 'HD · Tanpa Watermark', tag: 'HD', ext: 'mp4', kind: 'video', size: fmtSize(d.hd_size), url: dlDirect(hd, { referer: 'https://www.tiktok.com/', filename: `${base}-hd` }) });
  if (play) formats.push({ id: 'sd', label: 'SD · Tanpa Watermark', tag: hd ? 'SD' : 'HD', ext: 'mp4', kind: 'video', size: fmtSize(d.size), url: dlDirect(play, { referer: 'https://www.tiktok.com/', filename: base }) });
  if (wm) formats.push({ id: 'wm', label: 'Dengan Watermark', tag: 'WM', ext: 'mp4', kind: 'video', url: dlDirect(wm, { referer: 'https://www.tiktok.com/', filename: `${base}-wm` }) });
  if (d.music) formats.push({ id: 'music', label: 'Sound · MP3', tag: 'MP3', ext: 'mp3', kind: 'audio', url: dlDirect(abs(d.music), { referer: 'https://www.tiktok.com/', filename: `${base}-sound` }) });

  if (!formats.length) throw new Error('tikwm returned no media urls');

  return {
    platform: 'tiktok', platformName: 'TikTok', url: ctx.url.href,
    title, author, thumbnail,
    duration: humanDuration(d.duration),
    kind: 'video', isPlaylist: false,
    views: d.play_count ?? d.stats?.playCount ?? null,
    likes: d.digg_count ?? d.stats?.likeCount ?? null,
    items: [{ id: d.id || base, title, thumbnail, duration: humanDuration(d.duration), kind: 'video', formats }],
    warnings: [],
  };
}

async function viaTiklydown(ctx) {
  try {
    const json = await getJson(`${TIKTOK_FALLBACK_BASE}/api/download?url=${encodeURIComponent(ctx.url.href)}`, {
      timeoutMs: 20_000,
      retries: 1,
      headers: { 'accept': 'application/json' },
    });

    if (!json || !json.video && !json.images) throw new Error('tiklydown returned no data');
    const d = json;
    const title = String(d.title || d.desc || 'TikTok video').replace(/<[^>]*>/g, '').trim();
    const base = slugify(title);
    const author = d.author?.name ? `${d.author.name}${d.author.username ? ` (@${d.author.username})` : ''}`.trim() : null;
    const thumbnail = d.cover || d.thumbnail || null;

    // Photo slide / carousel post
    if (Array.isArray(d.images) && d.images.length) {
      return {
        platform: 'tiktok', platformName: 'TikTok', url: ctx.url.href,
        title, author, thumbnail,
        duration: null,
        kind: 'gallery', isPlaylist: false,
        items: [{
          id: base,
          title, thumbnail,
          duration: null,
          kind: 'gallery',
          formats: d.images.map((img, i) => ({
            id: `img-${i + 1}`,
            label: `Photo ${i + 1}/${d.images.length}`,
            tag: 'IMG',
            ext: 'jpg',
            kind: 'image',
            url: dlDirect(img.url || img, { referer: 'https://www.tiktok.com/', filename: `${base}-${i + 1}` }),
          })).concat(
            d.music?.url
              ? [{ id: 'music', label: 'Sound · MP3', tag: 'MP3', ext: 'mp3', kind: 'audio', url: dlDirect(d.music.url, { referer: 'https://www.tiktok.com/', filename: `${base}-sound` }) }]
              : [],
          ),
        }],
        warnings: [],
        via: 'api-cadangan',
      };
    }

    const formats = [];
    if (d.video?.noWatermarkHD || d.video?.noWatermark) {
      const hdUrl = d.video?.noWatermarkHD || d.video?.noWatermark;
      const sdUrl = d.video?.noWatermark;
      if (hdUrl) formats.push({ id: 'hd', label: 'HD · Tanpa Watermark', tag: 'HD', ext: 'mp4', kind: 'video', url: dlDirect(hdUrl, { referer: 'https://www.tiktok.com/', filename: `${base}-hd` }) });
      if (sdUrl && sdUrl !== hdUrl) formats.push({ id: 'sd', label: 'SD · Tanpa Watermark', tag: hdUrl ? 'SD' : 'HD', ext: 'mp4', kind: 'video', url: dlDirect(sdUrl, { referer: 'https://www.tiktok.com/', filename: base }) });
      if (d.video?.watermark) formats.push({ id: 'wm', label: 'Dengan Watermark', tag: 'WM', ext: 'mp4', kind: 'video', url: dlDirect(d.video.watermark, { referer: 'https://www.tiktok.com/', filename: `${base}-wm` }) });
    }
    if (d.music?.url) formats.push({ id: 'music', label: 'Sound · MP3', tag: 'MP3', ext: 'mp3', kind: 'audio', url: dlDirect(d.music.url, { referer: 'https://www.tiktok.com/', filename: `${base}-sound` }) });

    if (!formats.length) throw new Error('tiklydown returned no media urls');

    return {
      platform: 'tiktok', platformName: 'TikTok', url: ctx.url.href,
      title, author, thumbnail,
      duration: d.duration ? humanDuration(d.duration) : null,
      kind: 'video', isPlaylist: false,
      views: d.stats?.playCount ?? null,
      likes: d.stats?.likeCount ?? null,
      items: [{ id: base, title, thumbnail, duration: d.duration ? humanDuration(d.duration) : null, kind: 'video', formats }],
      warnings: [],
      via: 'api-cadangan',
    };
  } catch (e) {
    throw e;
  }
}

module.exports = { 
  id: 'tiktok', 
  name: 'TikTok', 
  methods: [
    { name: 'tikwm', run: viaTikwm },
    { name: 'tiklydown', run: viaTiklydown, optional: () => false },
  ] 
};

'use strict';
const crypto = require('node:crypto');
const { once } = require('node:events');
const config = require('../../config');
const { AppError } = require('../../lib/errors');
const { slugify } = require('../../resolvers/normalize');
const network = require('./network');
const tickets = new Map();
const MAX_TICKETS = 4000;
function issue(spec, { kind, title, provider }) {
  network.validateUrl(spec.url);
  if (!['audio', 'video', 'image'].includes(kind) || (spec.method && !['GET', 'POST'].includes(spec.method))) throw new Error('Unsupported media request');
  if (spec.body && Buffer.byteLength(spec.body) > 65536) throw new Error('Provider media payload too large');
  for (const [id, record] of tickets) if (record.expires <= Date.now()) tickets.delete(id);
  while (tickets.size >= MAX_TICKETS) tickets.delete(tickets.keys().next().value);
  const token = crypto.randomBytes(24).toString('base64url');
  tickets.set(token, { spec, kind, filename: slugify(title), provider, expires: Date.now() + Math.max(config.cacheTtlMs + 60000, 900000) });
  return `/api/dl?t=scrapr&ticket=${token}`;
}
function get(token) { const r = tickets.get(String(token || '')); if (!r || r.expires <= Date.now()) { tickets.delete(String(token || '')); return null; } return r; }
function resultTicketsValid(result) {
  return (result.items || []).every(it => (it.formats || []).every(f => {
    try { const u = new URL(f.url, 'http://local'); return u.searchParams.get('t') !== 'scrapr' || !!get(u.searchParams.get('ticket')); } catch { return false; }
  }));
}
function mediaType(contentType, chunk, kind) {
  const mime = String(contentType || '').split(';')[0].toLowerCase(); const b = Buffer.from(chunk);
  if (/^(?:<!doctype|<html|<head|<script|\{|\[)/i.test(b.subarray(0, 100).toString('utf8').trimStart())) throw new Error('Provider returned HTML/JSON, not a media file');
  const formats = {
    'audio/mpeg': ['mp3', 'audio'], 'audio/mp3': ['mp3', 'audio'], 'audio/mp4': ['m4a', 'audio'], 'audio/aac': ['aac', 'audio'], 'audio/ogg': ['ogg', 'audio'], 'audio/flac': ['flac', 'audio'], 'audio/wav': ['wav', 'audio'],
    'video/mp4': ['mp4', 'video'], 'video/webm': ['webm', 'video'], 'video/x-flv': ['flv', 'video'],
    'image/jpeg': ['jpg', 'image'], 'image/png': ['png', 'image'], 'image/webp': ['webp', 'image'], 'image/gif': ['gif', 'image'],
  };
  const known = formats[mime]; if (known && known[1] === kind) return { mime, ext: known[0] };
  if (mime !== 'application/octet-stream' && mime !== 'binary/octet-stream') throw new Error(`Provider did not return ${kind} media`);
  if (kind === 'audio' && (b.subarray(0, 3).toString() === 'ID3' || (b[0] === 255 && (b[1] & 224) === 224))) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (kind === 'video' && b.subarray(4, 8).toString() === 'ftyp') return { mime: 'video/mp4', ext: 'mp4' };
  if (kind === 'image' && b[0] === 255 && b[1] === 216) return { mime: 'image/jpeg', ext: 'jpg' };
  throw new Error('Unrecognized provider media payload');
}
async function download(req, res) {
  const record = get(req.query.ticket);
  if (!record) throw new AppError('MEDIA_EXPIRED', { status: 410, title: 'Link provider sudah kedaluwarsa', message: 'Ambil ulang link sumber untuk menyiapkan unduhan baru.' });
  const controller = new AbortController(); const stop = () => controller.abort();
  const timer = setTimeout(stop, 180000); res.once('close', stop);
  let reader;
  try {
    const spec = record.spec.refresh ? await record.spec.refresh(controller.signal) : record.spec;
    const response = await network.safeFetch(spec.url, { ...spec, signal: controller.signal });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error(`Provider HTTP ${response.status}`); }
    const limit = config.scraprMaxDownloadMb * 1048576;
    if (Number(response.headers.get('content-length')) > limit) { await response.body.cancel(); throw new Error('File exceeds scraper download size limit'); }
    reader = response.body.getReader();
    // Accumulate enough of the first bytes to reject HTML/JSON even if split across packets.
    const prefix = []; let bytes = 0;
    while (bytes < 128) { const p = await reader.read(); if (p.done) break; prefix.push(p.value); bytes += p.value.length; }
    if (!bytes) throw new Error('Provider returned an empty file');
    const first = Buffer.concat(prefix); const type = mediaType(response.headers.get('content-type'), first, record.kind);
    res.setHeader('Content-Type', type.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${record.filename}.${type.ext}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-VELOX-Engine', record.provider);
    if (bytes > limit) throw new Error('File exceeds scraper download size limit');
    if (!res.write(first)) await once(res, 'drain', { signal: controller.signal });
    for (;;) { const p = await reader.read(); if (p.done) break; bytes += p.value.length;
      if (bytes > limit) throw new Error('File exceeds scraper download size limit');
      if (!res.write(p.value)) await once(res, 'drain', { signal: controller.signal }); }
    res.end();
  } catch (err) {
    tickets.delete(String(req.query.ticket || ''));
    if (res.headersSent) { res.destroy(); return; }
    throw new AppError('SCRAPR_DOWNLOAD_FAILED', { status: 502, title: 'File provider belum bisa diunduh', message: 'Provider tidak memberikan file media yang valid, link-nya kedaluwarsa, atau aksesnya dibatasi.', hint: 'Ambil ulang link sumber dan coba lagi. Halaman HTML/JSON tidak disimpan sebagai MP3/MP4.' });
  } finally { clearTimeout(timer); res.off('close', stop); controller.abort(); if (reader) await reader.cancel().catch(() => {}); }
}
module.exports = { issue, get, resultTicketsValid, mediaType, download, _tickets: tickets };

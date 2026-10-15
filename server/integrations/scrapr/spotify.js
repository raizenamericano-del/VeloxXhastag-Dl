'use strict';
/* Adapted from coflyn/scrapr (MIT, see LICENSE and PROVENANCE.md).
 * Spotimate/SpotiDown parsing and Spotisaver signature flow retained; remote
 * code evaluation, placeholder downloads and unsupported quality claims removed.
 */
const cheerio = require('cheerio');
const JSON5 = require('json5');
const network = require('./network');
const { parseSpotifyUrl } = require('../../resolvers/spotify');
const { publicRequest } = require('../../lib/public-fetch');

async function canonical(url, signal) {
  let u = new URL(url);
  if (['spotify.link', 'spoti.fi'].includes(u.hostname)) u = await publicRequest(u.href, { hosts: ['spotify.link', 'spoti.fi', 'open.spotify.com'], mode: 'url', signal });
  const link = parseSpotifyUrl(u.href);
  if (link.type !== 'track') throw new Error('Scrapr audio currently supports individual tracks only');
  return link;
}
function multipart(fields) { const f = new FormData(); for (const [k, v] of Object.entries(fields)) if (v != null) f.set(k, String(v)); return f; }
function metadata(value) { try { const d = JSON.parse(Buffer.from(String(value), 'base64').toString()); return d && typeof d === 'object' ? d : {}; } catch { return {}; } }
function mediaLinks(html, origin, headers) {
  const $ = cheerio.load(String(html || '')); const links = []; const seen = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href'); const text = $(a).text().trim(); let u;
    try { u = network.validateUrl(new URL(href, origin).href); } catch { return; }
    if (seen.has(u.href) || /spotify\.com$/.test(u.hostname) || /tunecable/i.test(u.hostname) || /another song|premium/i.test(text) || /\/(?:action(?:\/track)?|en\d*|premium(?:\.html)?)\/?$/i.test(u.pathname) || u.pathname === '/') return;
    const image = /cover|\.(?:jpg|jpeg|png|webp)(?:$|\?)/i.test(text + ' ' + u.href);
    if (!image && !/download|mp3|audio|unduh/i.test(text) && !/\.(?:mp3|m4a|aac)(?:$|\?)/i.test(u.href)) return;
    seen.add(u.href);
    links.push({ kind: image ? 'image' : 'audio', spec: { url: u.href, headers: u.origin === origin ? headers : { referer: origin + '/' } }, label: image ? 'Cover · Provider' : 'Audio · Provider', note: 'Format dan kualitas mengikuti file provider; bukan preview resmi Spotify' });
  });
  return links;
}
async function spotimate(url, signal) {
  const link = await canonical(url, signal); const s = network.session('https://spotimate.app', signal);
  await s.request('/en1'); let token = '';
  try { const v = await s.request('/api/userverify', { method: 'POST', body: new URLSearchParams({ url: link.url }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-requested-with': 'XMLHttpRequest' }, json: true }); token = v.token || ''; } catch { if (signal?.aborted) throw new Error('Provider deadline reached'); }
  const act = await s.request('/action', { method: 'POST', body: multipart({ url: link.url, cftoken: token }), json: true });
  if (act.success === false) throw new Error('Spotimate refused the request');
  const $ = cheerio.load(String(act.html || '')); const form = $('form').filter((_, e) => $(e).find('input[name="data"]').length).first();
  const data = form.find('input[name="data"]').val(); const trackToken = form.find('input[name="token"],input[name="track_token"]').first().val();
  if (!data || !trackToken) throw new Error('Spotimate did not return track parameters');
  const meta = metadata(data);
  const result = await s.request('/action/track', { method: 'POST', body: multipart({ data, base: link.url, token: trackToken }), json: true });
  const media = mediaLinks(result.data || result.html, s.origin, s.headers());
  if (!media.some(m => m.kind === 'audio')) throw new Error('Spotimate returned no real audio link');
  return { url: link.url, title: meta.name || meta.title || $('h2,h3').first().text(), author: meta.artist || meta.singer || null, thumbnail: meta.cover || $('img').first().attr('src'), media };
}
async function spotidown(url, signal) {
  const link = await canonical(url, signal); const s = network.session('https://spotidown.app', signal);
  // No forged CAPTCHA answer: if the site requires a challenge, this provider fails normally.
  const act = await s.request('/action', { method: 'POST', body: new URLSearchParams({ url: link.url }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-requested-with': 'XMLHttpRequest' }, json: true });
  if (act.error) throw new Error('SpotiDown refused the request');
  const $ = cheerio.load(String(act.data || act.html || '')); const form = $('form[name="submitspurl"]').first();
  const data = form.find('input[name="data"]').val(); const token = form.find('input[name="token"]').val();
  if (!data || !token) throw new Error('SpotiDown did not return track parameters');
  const meta = metadata(data);
  const r = await s.request('/action/track', { method: 'POST', body: new URLSearchParams({ data, base: link.url, token }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, json: true });
  if (r.error) throw new Error('SpotiDown could not resolve the track');
  const media = mediaLinks(r.data || r.html, s.origin, s.headers());
  if (!media.some(m => m.kind === 'audio')) throw new Error('SpotiDown returned no real audio link');
  return { url: link.url, title: meta.name || meta.title || $('h1,h2,h3').first().text(), author: meta.artist || meta.singer, thumbnail: meta.cover || $('img').first().attr('src'), media };
}
function parseSignature(html) {
  const match = String(html).match(/playlistRequestSignature\s*=\s*(\{[\s\S]*?\});/);
  if (!match) throw new Error('Spotisaver signature configuration unavailable');
  // JSON5 parses data only. Never eval/new Function remote HTML.
  const data = JSON5.parse(match[1]); const wire = data.wire || {};
  const names = [wire.token_param, wire.action_param, wire.ctx_param, wire.sig_header, wire.exp_header];
  if (names.some(n => typeof n !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(n))) throw new Error('Invalid signature field names');
  if ([wire.sig_header, wire.exp_header].some(h => /^(?:host|cookie|authorization|connection|content-length|content-type|origin|referer)$/i.test(h))) throw new Error('Unsafe signature header');
  const endpoint = new URL(data.endpoint, 'https://spotisaver.net');
  if (endpoint.origin !== 'https://spotisaver.net' || !data.requestToken || !wire.actions?.get_playlist || !wire.actions?.download_track) throw new Error('Invalid signature configuration');
  return data;
}
async function spotisaver(url, signal) {
  const link = await canonical(url, signal); const s = network.session('https://spotisaver.net', signal);
  const html = await s.request('/en1'); const sig = parseSignature(html); const wire = sig.wire;
  const context = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  const signPath = (action, data) => sig.endpoint + (sig.endpoint.includes('?') ? '&' : '?') + new URLSearchParams({ [wire.token_param]: sig.requestToken, [wire.action_param]: wire.actions[action], [wire.ctx_param]: context(data) });
  const sign = await s.request(signPath('get_playlist', { id: link.id, type: 'track', lang: 'en' }), { json: true });
  if (!sign.success || !sign.token) throw new Error('Spotisaver signature request failed');
  const data = await s.request(`/api/get_playlist.php?id=${link.id}&type=track&lang=en`, { json: true, headers: { [wire.sig_header]: String(sign.token), [wire.exp_header]: String(sign.exp) } });
  const track = data.tracks?.find(t => String(t.id) === link.id);
  if (data.error || !track) throw new Error('Spotisaver did not return the requested track');
  const savedHeaders = s.headers(); const userIp = html.match(/user_ip\s*=\s*["']([^"']*)["']/)?.[1] || '';
  const refresh = async downloadSignal => {
    const ctx = { lang: 'en', id: String(track.id), name: String(track.name || ''), duration_ms: String(Math.trunc(track.duration_ms || 0)) };
    const signatureResponse = await network.safeFetch(new URL(signPath('download_track', ctx), s.origin).href, { headers: savedHeaders, signal: downloadSignal, allowedHosts: ['spotisaver.net'] });
    const token = JSON.parse(await network.readText(signatureResponse));
    if (!token.success || !token.token) throw new Error('Fresh media signature unavailable');
    return { url: s.origin + '/api/download_track.php', method: 'POST', headers: { ...savedHeaders, 'content-type': 'application/json', [wire.sig_header]: String(token.token), [wire.exp_header]: String(token.exp) },
      body: JSON.stringify({ track, download_dir: 'downloads', filename_tag: 'SPOTISAVER', user_ip: userIp, is_premium: false, lang: 'en' }) };
  };
  return { url: link.url, title: track.name, author: Array.isArray(track.artists) ? track.artists.map(a => typeof a === 'string' ? a : a?.name).filter(Boolean).join(', ') : null, thumbnail: track.image?.url,
    media: [{ kind: 'audio', label: 'Audio · Provider', note: 'Disediakan Spotisaver; format/kualitas belum diverifikasi sampai file diterima', spec: { url: s.origin + '/api/download_track.php', refresh } }] };
}
module.exports = { spotimate, spotidown, spotisaver, mediaLinks, parseSignature, canonical };

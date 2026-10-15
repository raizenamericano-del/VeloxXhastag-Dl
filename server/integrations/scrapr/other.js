'use strict';
/* Adapted from coflyn/scrapr lib/reddit/rapidsave and lib/bilibili/direct (MIT).
 * More restrictive URL parsing, actual returned quality, and multipart handling.
 */
const cheerio = require('cheerio');
const network = require('./network');
const { publicRequest } = require('../../lib/public-fetch');
const { postId } = require('../../resolvers/reddit');
async function rapidsave(url, signal) {
  let u = new URL(url);
  if (!/(^|\.)(reddit\.com|redd\.it)$/.test(u.hostname)) throw new Error('Invalid Reddit URL');
  if (!postId(u.href) && /\/s\//.test(u.pathname)) u = await publicRequest(u.href, { hosts: ['reddit.com', 'redd.it'], mode: 'url', signal });
  if (!postId(u.href)) throw new Error('Use a Reddit post URL');
  const s = network.session('https://rapidsave.com', signal);
  const html = await s.request('/info?url=' + encodeURIComponent(u.href)); const $ = cheerio.load(html);
  const anchor = $('a.downloadbutton[href], a[href*="sd.rapidsave.com/download.php"]').first();
  const href = anchor.attr('href'); if (!href) throw new Error('RapidSave returned no download link');
  const video = network.validateUrl(new URL(href, s.origin).href);
  // Do not accept unrelated advertisement downloads as a Reddit video.
  if (!/(^|\.)(rapidsave\.com|redd\.it)$/.test(video.hostname)) throw new Error('Unexpected RapidSave download host');
  const title = $('p.text-center,h2,strong').filter((_, e) => $(e).text().trim()).first().text().trim() || 'Reddit Video';
  const media = [{ kind: 'video', label: 'Video · RapidSave', note: 'Audio dan kualitas mengikuti file provider', spec: { url: video.href, headers: { referer: s.origin + '/' } } }];
  const audio = video.searchParams.get('audio_url');
  if (audio) { try { const a = network.validateUrl(audio); if (/(^|\.)v\.redd\.it$/.test(a.hostname)) media.push({ kind: 'audio', label: 'Audio · Sumber Reddit', spec: { url: a.href } }); } catch { /* no unsafe external audio */ } }
  return { url: u.href, title, thumbnail: $('img[src*="thumbs.rapidsave.com"]').first().attr('src'), media };
}
async function bilibili(url, signal) {
  let u = new URL(url);
  if (/(^|\.)b23\.tv$/.test(u.hostname)) u = await publicRequest(u.href, { hosts: ['b23.tv', 'bilibili.com'], mode: 'url', signal });
  if (!/(^|\.)bilibili\.com$/.test(u.hostname)) throw new Error('Use a mainland Bilibili video URL');
  const bv = u.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i)?.[1]; const av = u.pathname.match(/\/video\/av(\d+)/i)?.[1];
  if (!bv && !av) throw new Error('Invalid BV/AV video ID');
  const s = network.session('https://api.bilibili.com', signal); const headers = { referer: 'https://www.bilibili.com/', 'user-agent': 'Bilibili/1.0' };
  const view = await s.request('/x/web-interface/view?' + new URLSearchParams(bv ? { bvid: bv } : { aid: av }), { json: true, headers });
  if (view.code !== 0 || !view.data) throw new Error('Bilibili view API refused the request');
  const info = view.data; const page = Number(u.searchParams.get('p') || 1);
  if (!Number.isInteger(page) || page < 1) throw new Error('Invalid Bilibili page index');
  const cid = info.pages?.[page - 1]?.cid || (page === 1 ? info.cid : null);
  if (!cid) throw new Error('Requested Bilibili page does not exist');
  const play = await s.request('/x/player/playurl?' + new URLSearchParams({ bvid: info.bvid || bv, cid: String(cid), qn: '64' }), { json: true, headers });
  if (play.code !== 0) throw new Error('Bilibili stream API refused the request');
  const quality = ({ 16: '360p', 32: '480p', 64: '720p', 80: '1080p' })[play.data?.quality] || 'Format sumber';
  const parts = play.data?.durl || [];
  const media = parts.filter(p => p?.url).map((p, i) => ({ kind: 'video', label: `Video · ${quality}${parts.length > 1 ? ` · Bagian ${i + 1}/${parts.length}` : ''}`,
    note: parts.length > 1 ? 'Bagian terpisah, bukan pilihan kualitas yang berbeda' : 'Format dan kualitas sesuai respons API Bilibili',
    spec: { url: p.url.replace(/^http:/, 'https:'), headers } }));
  if (!media.length) throw new Error('Bilibili returned no stream URLs');
  return { url: u.href, title: info.title, description: info.desc, descriptionSource: 'description', author: info.owner?.name, thumbnail: String(info.pic || '').replace(/^http:/, 'https:'), media };
}
module.exports = { rapidsave, bilibili };

'use strict';
// Isolated transport for adapted scrapr providers; legacy resolvers do not use it.
const dns = require('node:dns');
const net = require('node:net');
const ipaddr = require('ipaddr.js');
const { Agent } = require('undici');
const config = require('../../config');

function isPublicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
function safeLookup(host, options, callback) {
  dns.lookup(host, { all: true, family: options?.family || 0 }, (err, entries) => {
    if (err) return callback(err);
    if (!entries.length || entries.some(e => !isPublicAddress(e.address))) return callback(new Error('Private/reserved DNS address rejected'));
    // The socket connects to this validated address; no second unvalidated lookup.
    if (options?.all) callback(null, entries);
    else callback(null, entries[0].address, entries[0].family);
  });
}
const dispatcher = new Agent({ connect: { lookup: safeLookup, timeout: 10000 }, maxHeaderSize: 32768 });
function validateUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || net.isIP(u.hostname.replace(/^\[|\]$/g, '')) ||
      !u.hostname.includes('.') || /\.(local|internal|localhost|invalid)$/.test(u.hostname)) throw new Error('Unsafe scraper URL rejected');
  return u;
}
async function safeFetch(input, { method = 'GET', body, headers = {}, signal, allowedHosts } = {}) {
  let url = validateUrl(input); let requestHeaders = { 'user-agent': config.userAgent, accept: '*/*', ...headers };
  for (let i = 0; i <= 4; i++) {
    if (allowedHosts && !allowedHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) throw new Error('Scraper host not permitted');
    const response = await fetch(url.href, { method, body, headers: requestHeaders, redirect: 'manual', signal: signal || AbortSignal.timeout(15000), dispatcher });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (!location || i === 4) throw new Error('Scraper redirect limit reached');
    const next = validateUrl(new URL(location, url).href);
    if (next.origin !== url.origin) {
      if (method !== 'GET' && response.status !== 303) throw new Error('Cross-origin POST redirect refused');
      // No cookies, signature tokens, or request payload forwarded to another site.
      requestHeaders = { 'user-agent': config.userAgent, accept: headers.accept || '*/*' };
    }
    if (response.status === 303 || ([301, 302].includes(response.status) && method === 'POST')) { method = 'GET'; body = undefined; delete requestHeaders['content-type']; }
    url = next;
  }
}
async function readText(response, maxBytes = 2097152) {
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Scraper HTTP ${response.status}`); }
  if (!response.body) throw new Error('Empty scraper response');
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length;
    if (bytes > maxBytes) { await reader.cancel(); throw new Error('Scraper response too large'); } chunks.push(part.value); }
  return Buffer.concat(chunks).toString('utf8');
}
function session(base, signal) {
  const origin = new URL(base).origin; const cookies = new Map();
  const cookie = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  const defaultHeaders = () => ({ 'user-agent': config.userAgent, origin, referer: origin + '/', ...(cookies.size ? { cookie: cookie() } : {}) });
  async function request(path, { method = 'GET', headers = {}, body, json = false } = {}) {
    const target = new URL(path, origin);
    if (target.origin !== origin) throw new Error('Provider endpoint escaped its origin');
    const response = await safeFetch(target.href, { method, body, signal, allowedHosts: [target.hostname], headers: { ...defaultHeaders(), ...headers } });
    for (const c of response.headers.getSetCookie?.() || []) {
      const pair = c.split(';')[0]; const eq = pair.indexOf('=');
      if (eq > 0 && cookies.size < 40 && !/[\r\n]/.test(pair)) cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    const text = await readText(response);
    return json ? JSON.parse(text) : text;
  }
  return { request, headers: defaultHeaders, origin };
}
module.exports = { safeFetch, validateUrl, isPublicAddress, safeLookup, readText, session };

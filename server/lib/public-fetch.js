'use strict';

// Bounded requests for the new public-source integrations. Every redirect is
// checked; Authorization is never forwarded to a redirected destination.
const config = require('../config');
function allowed(url, hosts) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      hosts.some(host => u.hostname === host || u.hostname.endsWith('.' + host));
  } catch { return false; }
}
async function publicRequest(url, { hosts, signal, timeoutMs = 12000, maxBytes = 2097152, mode = 'json', method = 'GET', headers = {}, body } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, timeoutMs);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    let target = String(url);
    for (let n = 0; n <= 5; n++) {
      if (!allowed(target, hosts || [])) throw new Error('Public source URL is not allowed');
      const response = await fetch(target, { method, body, redirect: 'manual', signal: controller.signal,
        headers: { 'user-agent': config.userAgent, accept: 'application/json', ...headers } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (Object.keys(headers).some(k => k.toLowerCase() === 'authorization')) throw new Error('Authenticated redirects are not allowed');
        const location = response.headers.get('location');
        if (!location || n === 5) throw new Error('Too many redirects from public source');
        target = new URL(location, target).href;
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error(`HTTP Error ${response.status}`), { status: response.status }); }
      if (mode === 'url') { await response.body?.cancel(); return new URL(target); }
      if (!response.body) throw new Error('Empty response from public source');
      const chunks = []; let length = 0; const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.length;
        if (length > maxBytes) { await reader.cancel(); throw new Error('Public source response is too large'); }
        chunks.push(value);
      }
      const text = Buffer.concat(chunks).toString('utf8');
      return mode === 'text' ? text : JSON.parse(text);
    }
    throw new Error('Too many redirects');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
module.exports = { publicRequest, allowed };

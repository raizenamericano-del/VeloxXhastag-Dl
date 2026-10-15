'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PLATFORMS, detect } = require('../../server/lib/detect');
const resolvers = require('../../server/resolvers');
const spotify = require('../../server/resolvers/spotify');
const bluesky = require('../../server/resolvers/bluesky');
const reddit = require('../../server/resolvers/reddit');
const engine = require('../../server/lib/ytdlp');
const config = require('../../server/config');
const { publicRequest, allowed } = require('../../server/lib/public-fetch');
const { hostAllowed } = require('../../server/index');
const TRACK = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT';
const ctx = url => ({ url: new URL(url), platform: detect(new URL(url)) });
const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
function mockFetch(t, handler) { const original = global.fetch; global.fetch = handler; t.after(() => { global.fetch = original; }); }
function credentials(t, enabled = false) {
  const previous = [config.spotifyClientId, config.spotifyClientSecret];
  const priorScrapr = config.scraprEnabled; config.scraprEnabled = false; t.after(() => { config.scraprEnabled = priorScrapr; });
  config.spotifyClientId = enabled ? 'fixture-client' : ''; config.spotifyClientSecret = enabled ? 'fixture-secret' : ''; spotify._clearToken();
  t.after(() => { [config.spotifyClientId, config.spotifyClientSecret] = previous; spotify._clearToken(); });
}
function noEngine(t) { const original = engine.isAvailable; engine.isAvailable = () => false; t.after(() => { engine.isAvailable = original; }); }

test('2.1 registry contains 19 unique integrations with Spotify explicitly limited', () => {
  assert.equal(PLATFORMS.length, 19); assert.equal(new Set(PLATFORMS.map(p => p.id)).size, 19);
  assert.equal(detect(TRACK).mode, 'provider-audio');
  assert.match(detect(TRACK).limitation, /pihak ketiga/);
});
test('2.1 detectors recognize canonical, localized and short source links', () => {
  const cases = { [TRACK]: 'spotify', 'https://open.spotify.com/intl-id/track/4cOdK2wGLETKBW3PvgPWqT': 'spotify',
    'https://spotify.link/abc': 'spotify', 'https://spoti.fi/abc': 'spotify', 'https://old.reddit.com/r/test/comments/abc/': 'reddit', 'https://redd.it/abc': 'reddit',
    'https://bsky.app/profile/name.bsky.social/post/abc': 'bluesky', 'https://artist.tumblr.com/post/123': 'tumblr',
    'https://www.tumblr.com/artist/123/title': 'tumblr', 'https://www.bilibili.com/video/BV1xx411c7mD/': 'bilibili', 'https://b23.tv/abc': 'bilibili' };
  for (const [url, id] of Object.entries(cases)) assert.equal(detect(url).id, id, url);
});
test('2.1 platform detection rejects lookalike domains', () => {
  for (const host of ['open.spotify.com.evil.test', 'fakebsky.app', 'notreddit.com', 'tumblr.com.example.org', 'bilibili.com.evil.test']) assert.equal(detect('https://' + host).id, 'generic');
});
test('Spotify uses selected scrapr adapters and official fallback, not legacy AIO or engine', () => {
  assert.deepEqual(resolvers.chainFor(ctx(TRACK)).map(c => c.method.name), ['scrapr-spotisaver', 'scrapr-spotidown', 'scrapr-spotmate', 'spotify-official']);
});
test('new media sources use explicit native/engine routes instead of unrelated AIOs', () => {
  const expected = { 'https://redd.it/abc': ['reddit-public', 'scrapr-rapidsave', 'engine'], 'https://bsky.app/profile/abc/post/1': ['bluesky-public', 'engine'], 'https://a.tumblr.com/post/123': ['engine'], 'https://b23.tv/abc': ['scrapr-bilibili', 'engine'] };
  for (const [url, chain] of Object.entries(expected)) assert.deepEqual(resolvers.chainFor(ctx(url)).map(c => c.method.name), chain);
});
test('Spotify canonicalization strips locale, embed prefix and tracking parameters', () => {
  assert.equal(spotify.parseSpotifyUrl(TRACK + '?si=tracking').url, TRACK);
  assert.equal(spotify.parseSpotifyUrl(TRACK.replace('/track/', '/intl-id/track/')).url, TRACK);
  assert.equal(spotify.parseSpotifyUrl(TRACK.replace('/track/', '/embed/track/')).url, TRACK);
  for (const url of ['https://evil.test/track/4cOdK2wGLETKBW3PvgPWqT', TRACK.replace('/track/', '/artist/'), TRACK + '/extra']) assert.throws(() => spotify.parseSpotifyUrl(url));
});
test('Spotify only accepts official MP3 preview paths', () => {
  assert.ok(spotify.previewAllowed('https://p.scdn.co/mp3-preview/abc'));
  for (const u of ['https://p.scdn.co.evil.test/mp3-preview/a', 'https://p.scdn.co/encrypted/full-track', 'http://p.scdn.co/mp3-preview/a', 'https://user:pass@p.scdn.co/mp3-preview/a']) assert.equal(spotify.previewAllowed(u), false);
});
test('Spotify works without credentials as honest metadata-only result', async t => {
  credentials(t); const calls = [];
  mockFetch(t, async url => { calls.push(url); return json({ title: 'Fixture song', thumbnail_url: 'https://i.scdn.co/image/abc', html: '<script>never render this</script>' }); });
  const r = await resolvers.resolve(ctx(TRACK));
  assert.equal(r.title, 'Fixture song'); assert.equal(r.metadataOnly, true); assert.equal(r.availability, 'metadata');
  assert.equal(r.items[0].formats.length, 0); assert.equal(r.sourceUrl, TRACK);
  assert.equal(calls.length, 1); assert.ok(calls[0].startsWith('https://open.spotify.com/oembed?'));
  assert.equal(r.html, undefined); assert.match(r.notice, /tidak tersedia/);
});
test('Spotify optional official preview is labelled as a snippet, never a full song', async t => {
  credentials(t, true);
  mockFetch(t, async (url, options) => {
    if (url.includes('/oembed?')) return json({ title: 'Fixture song' });
    if (url.includes('/api/token')) { assert.match(options.headers.authorization, /^Basic /); return json({ access_token: 'fixture-token', expires_in: 3600 }); }
    assert.equal(options.headers.authorization, 'Bearer fixture-token');
    return json({ name: 'Fixture song', artists: [{ name: 'Fixture artist' }], duration_ms: 180000, preview_url: 'https://p.scdn.co/mp3-preview/fixture', album: { images: [] } });
  });
  const r = await spotify.methods[0].run(ctx(TRACK)); const f = r.items[0].formats[0];
  assert.equal(r.metadataOnly, false); assert.equal(r.author, 'Fixture artist'); assert.equal(f.tag, 'PREVIEW'); assert.match(f.note, /bukan lagu penuh/);
  assert.ok(f.url.startsWith('/api/dl?')); assert.match(new URL(f.url, 'http://localhost').searchParams.get('u'), /p.scdn.co\/mp3-preview/);
  assert.equal(JSON.stringify(r).includes('fixture-token'), false); assert.equal(JSON.stringify(r).includes('fixture-secret'), false);
});
test('Spotify null preview is not replaced with a fabricated audio download', async t => {
  credentials(t, true);
  mockFetch(t, async url => url.includes('/oembed?') ? json({ title: 'Fixture song' }) : url.includes('/api/token') ? json({ access_token: 'fixture', expires_in: 3600 }) : json({ name: 'Fixture song', preview_url: null }));
  const r = await spotify.methods[0].run(ctx(TRACK)); assert.equal(r.metadataOnly, true); assert.deepEqual(r.items[0].formats, []);
});
test('Spotify credential failure degrades to public metadata without leaking secret details', async t => {
  credentials(t, true);
  mockFetch(t, async url => url.includes('/oembed?') ? json({ title: 'Fixture song' }) : new Response('bad fixture-secret', { status: 401 }));
  const r = await spotify.methods[0].run(ctx(TRACK)); assert.equal(r.metadataOnly, true); assert.equal(JSON.stringify(r).includes('fixture-secret'), false);
});
test('Spotify collection links do not pretend to enumerate or download a playlist', async t => {
  credentials(t, true); let calls = 0;
  mockFetch(t, async () => { calls++; return json({ title: 'Fixture playlist' }); });
  const r = await spotify.methods[0].run(ctx(TRACK.replace('/track/', '/playlist/')));
  assert.equal(calls, 1); assert.equal(r.isPlaylist, false); assert.equal(r.contentType, 'playlist'); assert.equal(r.metadataOnly, true);
  assert.ok(r.warnings.some(w => /unduhan massal/.test(w.text)));
});
test('Spotify unavailable metadata yields a friendly error, not a fake success', async t => {
  credentials(t); mockFetch(t, async () => new Response('', { status: 404 }));
  await assert.rejects(spotify.methods[0].run(ctx(TRACK)), e => e.code === 'NOT_FOUND');
});
test('public-source requests validate every redirect before following it', async t => {
  let calls = 0; mockFetch(t, async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } }); });
  await assert.rejects(publicRequest('https://spotify.link/abc', { hosts: ['spotify.link', 'open.spotify.com'], mode: 'url' }), /not allowed/);
  assert.equal(calls, 1);
});
test('Spotify short links expand only to approved canonical sources', async t => {
  credentials(t); mockFetch(t, async url => {
    if (url === 'https://spotify.link/test') return new Response(null, { status: 302, headers: { location: TRACK } });
    if (url === TRACK) return new Response('page');
    return json({ title: 'Fixture song' });
  });
  const r = await spotify.methods[0].run(ctx('https://spotify.link/test')); assert.equal(r.sourceUrl, TRACK);
});
test('public-source requests refuse credentials, ports and prefix-spoofed hosts', () => {
  for (const u of ['https://user:secret@open.spotify.com/a', 'https://open.spotify.com:444/a', 'https://open.spotify.com.evil.test/a']) assert.equal(allowed(u, ['open.spotify.com']), false);
});
test('authenticated requests never forward a token on redirect', async t => {
  let calls = 0; mockFetch(t, async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://api.spotify.com/other' } }); });
  await assert.rejects(publicRequest('https://api.spotify.com/test', { hosts: ['api.spotify.com'], headers: { authorization: 'Bearer fixture' } }), /Authenticated redirects/); assert.equal(calls, 1);
});
test('public-source JSON response size is bounded', async t => {
  mockFetch(t, async () => json({ text: 'a'.repeat(100) }));
  await assert.rejects(publicRequest('https://open.spotify.com/oembed', { hosts: ['open.spotify.com'], maxBytes: 20 }), /too large/);
});
test('Reddit recognizes post and gallery IDs without accepting spoofed hosts', () => {
  assert.equal(reddit.postId('https://www.reddit.com/r/pics/comments/abc123/title'), 'abc123');
  assert.equal(reddit.postId('https://reddit.com/gallery/abc123'), 'abc123');
  assert.equal(reddit.postId('https://redd.it/abc123'), 'abc123');
  assert.equal(reddit.postId('https://evil.test/comments/abc123'), null);
});
test('Reddit public gallery produces separate allowlisted image downloads', async t => {
  mockFetch(t, async () => json([{ data: { children: [{ data: { title: 'Fixture gallery', author: 'tester', gallery_data: { items: [{ media_id: 'x' }, { media_id: 'y' }] }, media_metadata: { x: { status: 'valid', s: { u: 'https://i.redd.it/a.jpg' } }, y: { status: 'valid', s: { u: 'https://i.redd.it/b.png' } } } } }] } }]));
  const r = await reddit.methods[0].run(ctx('https://reddit.com/gallery/abc'));
  assert.equal(r.items.length, 2); assert.equal(r.kind, 'gallery'); assert.equal(r.items[1].formats[0].ext, 'png');
});
test('Reddit direct video is honestly labelled without guaranteed audio', async t => {
  noEngine(t); mockFetch(t, async () => json([{ data: { children: [{ data: { title: 'Fixture video', media: { reddit_video: { fallback_url: 'https://v.redd.it/abc/DASH_720.mp4', duration: 10 } } } }] } }]));
  const r = await reddit.methods[0].run(ctx('https://redd.it/abc'));
  assert.equal(r.items[0].formats.length, 1); assert.match(r.items[0].formats[0].note, /suara tidak dijamin/);
});
test('Reddit native integration ignores external media URLs', async t => {
  mockFetch(t, async () => json([{ data: { children: [{ data: { title: 'External', url: 'https://evil.test/photo.jpg' } }] } }]));
  await assert.rejects(reddit.methods[0].run(ctx('https://redd.it/abc')), e => e.code === 'NO_MEDIA');
});
test('Bluesky parses public handle and DID post links', () => {
  assert.equal(bluesky.parsePost('https://bsky.app/profile/name.bsky.social/post/abc').actor, 'name.bsky.social');
  assert.equal(bluesky.parsePost('https://bsky.app/profile/did:plc:abc123/post/abc').actor, 'did:plc:abc123');
  assert.throws(() => bluesky.parsePost('https://bsky.app/profile/name.bsky.social'));
});
test('Bluesky public image post resolves without an engine', async t => {
  noEngine(t); const calls = [];
  mockFetch(t, async url => { calls.push(url); return url.includes('resolveHandle') ? json({ did: 'did:plc:fixture' }) : json({ posts: [{ record: { text: 'Fixture photo' }, author: { handle: 'fixture.bsky.social' }, embed: { images: [{ fullsize: 'https://cdn.bsky.app/img/feed_fullsize/plain/fixture@jpeg' }] } }] }); });
  const r = await bluesky.methods[0].run(ctx('https://bsky.app/profile/fixture.bsky.social/post/abc'));
  assert.equal(r.items[0].formats[0].kind, 'image'); assert.equal(calls.length, 2); assert.equal(r.author, 'fixture.bsky.social');
});
test('Bluesky native media resolver does not download arbitrary external embeds', async t => {
  mockFetch(t, async () => json({ posts: [{ record: { text: 'External' }, embed: { external: { uri: 'https://evil.test/video' } } }] }));
  await assert.rejects(bluesky.methods[0].run(ctx('https://bsky.app/profile/did:plc:fixture/post/abc')), e => e.code === 'NO_MEDIA');
});
test('Bluesky HLS video requires an engine instead of saving an m3u8 as MP4', async t => {
  noEngine(t); mockFetch(t, async () => json({ posts: [{ record: { text: 'Video' }, embed: { playlist: 'https://video.bsky.app/watch/abc/playlist.m3u8' } }] }));
  await assert.rejects(bluesky.methods[0].run(ctx('https://bsky.app/profile/did:plc:fixture/post/abc')), e => e.code === 'ENGINE_MISSING');
});
test('new CDN allowlist admits real sources and rejects suffix spoofing', () => {
  const hosts = ['p.scdn.co', 'i.redd.it', 'v.redd.it', 'cdn.bsky.app', 'video.bsky.app', '64.media.tumblr.com', 'upos-sz-mirrorcos.bilivideo.com'];
  for (const host of hosts) { assert.equal(hostAllowed('https://' + host + '/file'), true); assert.equal(hostAllowed('https://' + host + '.evil.test/file'), false); }
});
test('source HTTP 412 is reported as a block, not as absence of media', () => {
  const { friendlyError } = require('../../server/lib/errors');
  assert.equal(friendlyError(new Error('Unable to download webpage: HTTP Error 412: Precondition Failed')).code, 'UPSTREAM_BLOCKED');
});
test('source disconnect is reported as a connection error, not as absence of media', () => {
  const { friendlyError } = require('../../server/lib/errors');
  assert.equal(friendlyError(new Error('Unable to download webpage: RemoteDisconnected Remote end closed connection')).code, 'NETWORK');
});

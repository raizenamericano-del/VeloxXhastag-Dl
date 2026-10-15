'use strict';
const config = require('../../config');
const { AppError } = require('../../lib/errors');
const { cleanTitle } = require('../../resolvers/normalize');
const media = require('./media');
const spotify = require('./spotify');
const other = require('./other');
const adapters = { spotisaver: spotify.spotisaver, spotidown: spotify.spotidown, spotmate: spotify.spotimate, rapidsave: other.rapidsave, bilibili: other.bilibili };
const labels = { spotisaver: 'Spotisaver', spotidown: 'SpotiDown', spotmate: 'Spotimate', rapidsave: 'RapidSave', bilibili: 'Bilibili API' };
function disabled(name) { return !config.scraprEnabled || config.scraprDisabled.includes(name); }
function method(name) {
  return { name: `scrapr-${name}`, optional: () => disabled(name), run: async ctx => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), config.scraprTimeoutMs);
    const signal = ctx.signal ? AbortSignal.any([ctx.signal, controller.signal]) : controller.signal;
    try {
      const r = await adapters[name](ctx.url.href, signal);
      if (!r?.media?.length) throw new Error('No media returned');
      const title = cleanTitle(r.title) || `${ctx.platform.name} media`;
      const formats = r.media.slice(0, 40).map((item, i) => ({ id: `scrapr-${name}-${i}`, kind: item.kind,
        label: item.label || `${item.kind === 'audio' ? 'Audio' : item.kind === 'image' ? 'Foto' : 'Video'} · ${labels[name]}`,
        tag: item.kind === 'audio' ? 'AUDIO' : item.kind === 'image' ? 'FOTO' : 'VIDEO', note: item.note || 'Format sesuai file sumber',
        url: media.issue(item.spec, { kind: item.kind, title: r.media.length > 1 ? `${title}-${i + 1}` : title, provider: `scrapr-${name}` }) }));
      const isSpotify = ctx.platform.id === 'spotify';
      return { platform: ctx.platform.id, platformName: ctx.platform.name, url: r.url || ctx.url.href, sourceUrl: r.url || ctx.url.href,
        title, description: r.description || '', descriptionSource: r.descriptionSource || 'title', author: r.author || null, thumbnail: r.thumbnail || null,
        kind: formats.some(f => f.kind === 'video') ? 'video' : formats.some(f => f.kind === 'audio') ? 'audio' : 'gallery',
        isPlaylist: false, metadataOnly: false, availability: isSpotify ? 'provider-audio' : 'media', contentType: isSpotify ? 'track' : undefined,
        mediaOrigin: name === 'bilibili' ? 'source-api' : 'third-party', providerLabel: labels[name],
        ...(isSpotify ? { notice: `Audio disediakan ${labels[name]} melalui adaptasi scrapr, bukan preview resmi atau jaminan file asli Spotify. Periksa kecocokan judul/artis dan gunakan hanya konten yang boleh kamu unduh.` } : {}),
        items: [{ id: `scrapr-${name}`, title, kind: isSpotify ? 'audio' : 'video', formats }],
        warnings: isSpotify ? [{ text: 'Kualitas, durasi, dan keberhasilan unduhan mengikuti provider. Album/playlist tetap memakai jalur info resmi.' }] : [],
      };
    } catch (err) {
      throw new AppError('SCRAPR_UNAVAILABLE', { status: 502, title: `${labels[name]} belum memberikan media`, message: 'Provider tidak tersedia, membatasi akses, atau responsnya tidak berisi file yang didukung.', hint: 'Jalur cadangan tetap dicoba. Gunakan link publik dan coba lagi nanti.' });
    } finally { clearTimeout(timer); controller.abort(); }
  } };
}
const methods = {
  spotify: ['spotisaver', 'spotidown', 'spotmate'].map(method),
  reddit: [method('rapidsave')], bilibili: [method('bilibili')],
};
module.exports = { methods, adapters, media, disabled };

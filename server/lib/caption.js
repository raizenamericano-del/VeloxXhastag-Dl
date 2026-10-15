'use strict';
// Additive text metadata: never changes titles, resolver order or download URLs.
const MAX_DESCRIPTION = 50000;
function text(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : '';
}
function extractHashtags(description, explicit = []) {
  const values = []; const seen = new Set();
  const add = raw => {
    if (typeof raw !== 'string') return;
    const tag = '#' + raw.trim().replace(/^[#＃]/, '').normalize('NFC');
    if (tag.length > 200 || !/^#[\p{L}\p{M}\p{N}_]+$/u.test(tag)) return;
    const key = tag.toLocaleLowerCase('und'); if (seen.has(key) || values.length >= 100) return;
    seen.add(key); values.push(tag);
  };
  // Do not mistake URL anchors (https://site/path#fragment) for hashtags.
  const withoutUrls = String(description || '').replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, ' ');
  for (const m of withoutUrls.matchAll(/(?:^|[^\p{L}\p{M}\p{N}_/&=])([#＃][\p{L}\p{M}\p{N}_]+)/gu)) add(m[1]);
  if (Array.isArray(explicit)) for (const v of explicit) add(typeof v === 'string' ? v : v?.name || v?.hashtag_name);
  return values;
}
function textMetadata({ description, caption, title, hashtags, descriptionSource, descriptionTruncated } = {}) {
  const actual = text(description) || text(caption); const full = actual || text(title);
  const source = descriptionSource || (actual ? 'description' : full ? 'title' : 'unavailable');
  const clipped = full.slice(0, MAX_DESCRIPTION);
  return { description: clipped, descriptionSource: source, descriptionTruncated: !!descriptionTruncated || full.length > MAX_DESCRIPTION,
    hashtags: extractHashtags(clipped, hashtags) };
}
function enrichText(result) {
  const source = result.descriptionSource || (!result.description && result.platform === 'tiktok' ? 'caption' : undefined);
  Object.assign(result, textMetadata({ ...result, descriptionSource: source }));
  return result;
}
module.exports = { text, textMetadata, extractHashtags, enrichText, MAX_DESCRIPTION };

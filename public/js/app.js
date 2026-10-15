/* ==========================================================================
   VELOX Studio 2.2 — frontend
   Vanilla JS, no build step, no external requests.
   ========================================================================== */
'use strict';

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ── platform registry (mirrors server/lib/detect.js) ───────────────────
  const PLATFORMS = [
    { id: 'tiktok', name: 'TikTok', tier: 1, color: '#25F4EE', kinds: 'Video · Foto · Audio', test: /tiktok\.com/i, sample: 'https://www.tiktok.com/@tiktok/video/7460937381265411370' },
    { id: 'instagram', name: 'Instagram', tier: 1, color: '#E1306C', kinds: 'Reels · Foto · Story', test: /instagram\.com/i, sample: 'https://www.instagram.com/reel/C1x2y3z/' },
    { id: 'youtube', name: 'YouTube', tier: 1, color: '#FF3B3B', kinds: 'Video · Shorts · Audio', test: /(youtube\.com|youtu\.be)/i, sample: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { id: 'facebook', name: 'Facebook', tier: 1, color: '#4C8DFF', kinds: 'Video · Reels · Watch', test: /(facebook\.com|fb\.watch|fb\.com)/i, sample: 'https://www.facebook.com/watch/?v=1234567890' },
    { id: 'twitter', name: 'X / Twitter', tier: 1, color: '#92988b', kinds: 'Video · GIF · Foto', test: /(twitter\.com|x\.com)/i, sample: 'https://x.com/i/status/1580661436132757506' },
    { id: 'pinterest', name: 'Pinterest', tier: 2, color: '#FF5252', kinds: 'Video · Image HD · GIF', test: /(pinterest\.|pin\.it)/i, sample: 'https://www.pinterest.com/pin/123456789/' },
    { id: 'rednote', name: 'RedNote', tier: 2, color: '#FF2442', kinds: 'Video · Foto', test: /(xiaohongshu\.com|xhslink\.com)/i, sample: 'https://www.xiaohongshu.com/explore/000000000000000000000000' },
    { id: 'snapchat', name: 'Snapchat', tier: 2, color: '#FFE14D', kinds: 'Spotlight · Story', test: /snapchat\.com/i, sample: 'https://www.snapchat.com/spotlight/abcdef' },
    { id: 'threads', name: 'Threads', tier: 2, color: '#92988b', kinds: 'Video · Image', test: /threads\.(net|com)/i, sample: 'https://www.threads.net/@user/post/ABC123' },
    { id: 'linkedin', name: 'LinkedIn', tier: 2, color: '#4A9EFF', kinds: 'Video · Post', test: /(linkedin\.com|lnkd\.in)/i, sample: 'https://www.linkedin.com/posts/user_activity-000' },
    { id: 'vimeo', name: 'Vimeo', tier: 3, color: '#4CC8F0', kinds: 'Video HD', test: /vimeo\.com/i, sample: 'https://vimeo.com/76979871' },
    { id: 'dailymotion', name: 'Dailymotion', tier: 3, color: '#5C9DFF', kinds: 'Video', test: /(dailymotion\.com|dai\.ly)/i, sample: 'https://www.dailymotion.com/video/x8abcde' },
    { id: 'twitch', name: 'Twitch', tier: 3, color: '#B084FF', kinds: 'Clip · VOD', test: /twitch\.tv/i, sample: 'https://clips.twitch.tv/SomeClipName' },
    { id: 'soundcloud', name: 'SoundCloud', tier: 3, color: '#FF8533', kinds: 'MP3', test: /(soundcloud\.com|snd\.sc)/i, sample: 'https://soundcloud.com/artist/track' },
    { id: 'spotify', name: 'Spotify', tier: 2, color: '#1DB954', kinds: 'Audio provider · Info', isNew: true, mode: 'provider-audio' },
    { id: 'reddit', name: 'Reddit', tier: 2, color: '#FF7945', kinds: 'Video · Foto · Galeri', isNew: true },
    { id: 'bluesky', name: 'Bluesky', tier: 2, color: '#449AFF', kinds: 'Video · Foto', isNew: true },
    { id: 'tumblr', name: 'Tumblr', tier: 3, color: '#9AACC5', kinds: 'Video · Audio', isNew: true },
    { id: 'bilibili', name: 'Bilibili', tier: 3, color: '#48C4EA', kinds: 'Video · Audio', isNew: true },
  ];
  const ICON_SLUG = { twitter: 'x', rednote: 'xiaohongshu' };
  const GLOBE = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.9a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4.1c.7 1 1.3 2.4 1.7 3.9h-3.4c.4-1.5 1-2.9 1.7-3.9ZM4.3 14a7.9 7.9 0 0 1 0-4h3.3a16 16 0 0 0 0 4H4.3Zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16Zm2.9-8H5.1a8 8 0 0 1 4.3-3.6A15.6 15.6 0 0 0 8 8ZM12 19.9c-.7-1-1.3-2.4-1.7-3.9h3.4c-.4 1.5-1 2.9-1.7 3.9ZM14 14H10a14 14 0 0 1 0-4h4a14 14 0 0 1 0 4Zm.6 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6Zm1.8-5.6a16 16 0 0 0 0-4h3.3a7.9 7.9 0 0 1 0 4h-3.3Z';

  const iconSvg = (id, size = 20) => {
    const slug = ICON_SLUG[id] || id;
    const d = (typeof ICONS !== 'undefined' && ICONS[slug]) || GLOBE;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
  };
  const colorOf = (id) => PLATFORMS.find((p) => p.id === id)?.color || '#7c5cff';
  const nameOf = (id) => PLATFORMS.find((p) => p.id === id)?.name || 'Website';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HOSTS = {
    tiktok: ['tiktok.com'], instagram: ['instagram.com'], youtube: ['youtube.com', 'youtu.be'],
    facebook: ['facebook.com', 'fb.watch', 'fb.com'], twitter: ['twitter.com', 'x.com'],
    pinterest: ['pinterest.com', 'pinterest.co.id', 'pinterest.co.uk', 'pin.it'],
    rednote: ['xiaohongshu.com', 'xhslink.com'], snapchat: ['snapchat.com'], threads: ['threads.net', 'threads.com'],
    linkedin: ['linkedin.com', 'lnkd.in'], vimeo: ['vimeo.com'], dailymotion: ['dailymotion.com', 'dai.ly'],
    twitch: ['twitch.tv'], soundcloud: ['soundcloud.com', 'snd.sc'],
    spotify: ['open.spotify.com', 'spotify.link', 'spoti.fi'], reddit: ['reddit.com', 'redd.it'],
    bluesky: ['bsky.app'], tumblr: ['tumblr.com'], bilibili: ['bilibili.com', 'b23.tv'],
  };
  const parsePublicUrl = (value) => {
    const text = String(value || '').trim();
    if (!text || /\s/.test(text)) return null;
    try {
      const u = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
      const host = u.hostname.toLowerCase();
      if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || /^\d+(\.\d+){3}$/.test(host)) return null;
      return u;
    } catch { return null; }
  };
  const detect = (v) => {
    const u = parsePublicUrl(v);
    return u ? PLATFORMS.find(p => HOSTS[p.id].some(host => u.hostname === host || u.hostname.endsWith('.' + host))) || null : null;
  };
  const safeImage = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const scrollToEl = (el) => el.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });

  // ── elements ───────────────────────────────────────────────────────────
  const form = $('#dlForm'), input = $('#urlInput'), goBtn = $('#goBtn');
  const shell = $('#inputShell'), iconEl = $('#platformIcon'), hint = $('#hintText'), formHint = $('#formHint');
  const zone = $('#resultZone'), statusPill = $('#statusPill'), statusText = $('#statusText');
  const drawer = $('#historyDrawer'), scrim = $('#scrim'), histList = $('#historyList'), histCount = $('#historyCount');
  const toasts = $('#toasts');

  const HINT_DEFAULT = 'Link publik saja. Kami kenali platformnya otomatis.';

  // ── toasts ─────────────────────────────────────────────────────────────
  function toast(kind, title, msg, ms = 4200) {
    const ico = kind === 'ok' ? '✓' : kind === 'err' ? '✕' : 'ℹ';
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span class="toast-ico">${ico}</span><div><b>${esc(title)}</b>${msg ? `<p>${esc(msg)}</p>` : ''}</div>`;
    toasts.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
  }

  // ── history (localStorage only — nothing leaves the browser) ───────────
  const HKEY = 'velox.history.v1';
  const readHistory = () => {
    try {
      const data = JSON.parse(localStorage.getItem(HKEY) || '[]');
      return Array.isArray(data) ? data.filter(h => h && typeof h.url === 'string' && parsePublicUrl(h.url)).slice(0, 30) : [];
    } catch { return []; }
  };
  const writeHistory = (list) => { try { localStorage.setItem(HKEY, JSON.stringify(list.slice(0, 30))); } catch { /* quota */ } };

  function pushHistory(entry) {
    const list = readHistory().filter((h) => h.url !== entry.url);
    list.unshift({ ...entry, ts: Date.now() });
    writeHistory(list);
    renderHistory();
  }
  function renderHistory() {
    const list = readHistory();
    $('#clearHistory').disabled = list.length === 0;
    histCount.hidden = list.length === 0;
    histCount.textContent = list.length;
    if (!list.length) {
      histList.innerHTML = '<div class="empty-state"><span>↺</span>Setiap inspirasi punya jejak.<br>Proses link pertamamu, lalu temukan kembali di sini.</div>';
      return;
    }
    histList.innerHTML = list.map((h, i) => `
      <div class="hist-item">
        ${safeImage(h.thumb) ? `<img class="hist-thumb" src="${esc(safeImage(h.thumb))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="hist-thumb"></div>'}
        <div class="hist-info">
          <div class="hist-title">${esc(h.title || h.url)}</div>
          <div class="hist-sub">${esc(nameOf(h.platform))} · ${new Date(h.ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          <div class="hist-acts">
            <button class="mini-btn" data-reopen="${i}">Buka lagi</button>
            <button class="mini-btn" data-copy="${esc(h.url)}">Salin</button>
          </div>
        </div>
        <button class="hist-del" data-del="${i}" aria-label="Hapus dari riwayat">✕</button>
      </div>`).join('');
    histList.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true }));
  }

  histList.addEventListener('click', async (e) => {
    const reopen = e.target.closest('[data-reopen]'), del = e.target.closest('[data-del]'), copy = e.target.closest('[data-copy]');
    const list = readHistory();
    if (reopen) { const h = list[+reopen.dataset.reopen]; if (h) { input.value = h.url; syncIcon(); closeDrawer(); submit(h.url); } }
    if (del) { writeHistory(list.filter((_, i) => i !== +del.dataset.del)); renderHistory(); }
    if (copy) { await copyText(copy.dataset.copy); }
  });

  $('#clearHistory').addEventListener('click', () => {
    const previous = readHistory();
    writeHistory([]); renderHistory();
    toast('info', 'Ruang untuk inspirasi baru', 'Riwayat di browser ini sudah dihapus.');
    if (previous.length) {
      const undo = document.createElement('button'); undo.className = 'text-btn'; undo.textContent = 'Urungkan';
      toasts.lastElementChild?.lastElementChild.appendChild(undo);
      undo.addEventListener('click', () => { writeHistory([...readHistory(), ...previous].filter((h, i, a) => a.findIndex(x => x.url === h.url) === i)); renderHistory(); undo.closest('.toast').remove(); toast('ok', 'Riwayat dipulihkan'); });
    }
  });

  async function copyText(t, title = 'Tersalin ke clipboard') {
    if (!t) { toast('info', 'Belum ada teks untuk disalin'); return false; }
    try { await navigator.clipboard.writeText(t); toast('ok', title); return true; }
    catch {
      const focused = document.activeElement, selection = document.getSelection();
      const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
      const field = document.createElement('textarea'); field.value = t; field.className = 'clipboard-fallback';
      // Keep fallback inside an open modal so inert page content cannot steal focus.
      (drawer.classList.contains('is-open') ? drawer : document.body).appendChild(field);
      field.focus(); field.select(); let ok = false;
      try { ok = !!document.execCommand?.('copy'); } catch { /* manual copy remains available */ }
      field.remove(); focused?.focus({ preventScroll: true });
      if (selection && ranges.length) { selection.removeAllRanges(); ranges.forEach(r => selection.addRange(r)); }
      if (ok) toast('ok', title);
      else toast('info', 'Salin secara manual', 'Browser membatasi clipboard. Pilih teks yang tersedia, lalu gunakan Salin / Ctrl+C.');
      return ok;
    }
  }

  let drawerReturnFocus = null;
  function openDrawer() {
    drawerReturnFocus = document.activeElement;
    drawer.inert = false; drawer.removeAttribute('inert');
    drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false');
    $('.page-shell').inert = true;
    scrim.hidden = false; document.body.style.overflow = 'hidden'; $('#closeHistory').focus();
  }
  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); drawer.inert = true;
    drawer.setAttribute('inert', ''); $('.page-shell').inert = false;
    scrim.hidden = true; document.body.style.overflow = ''; drawerReturnFocus?.focus();
  }
  drawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const nodes = $$('button:not(:disabled), a[href]', drawer);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  });
  $('#historyBtn').addEventListener('click', openDrawer);
  $('#closeHistory').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // ── live platform icon in the input ────────────────────────────────────
  function syncIcon() {
    $('#clearInput').hidden = !input.value;
    input.removeAttribute('aria-invalid');
    const p = detect(input.value);
    $('#spotifyInputNote').hidden = p?.id !== 'spotify';
    if (p) {
      iconEl.innerHTML = iconSvg(p.id, 20);
      iconEl.classList.add('is-live');
      iconEl.style.color = p.color;
      hint.textContent = p.id === 'spotify' ? 'Spotify terdeteksi · audio provider jika tersedia; info resmi sebagai cadangan.' : `${p.name} terdeteksi. Saatnya menyimpan inspirasi.`;
      formHint.classList.remove('has-err');
    } else {
      iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`;
      iconEl.classList.remove('is-live');
      iconEl.style.color = '';
      hint.textContent = HINT_DEFAULT;
      formHint.classList.remove('has-err');
    }
  }
  input.addEventListener('input', syncIcon);
  $('#clearInput').addEventListener('click', () => { input.value = ''; syncIcon(); input.focus(); });

  // ── paste button + global ctrl/⌘+V shortcut ────────────────────────────
  $('#pasteBtn').addEventListener('click', async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) return toast('info', 'Clipboard kosong');
      input.value = t; syncIcon(); input.focus();
    } catch { input.focus(); toast('info', 'Tempel manual', 'Tekan Ctrl+V di kolom input.'); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !drawer.classList.contains('is-open') && !document.activeElement?.matches('input, textarea, [contenteditable=true]')) {
      input.focus();
    }
  });

  // ── loading skeleton with rotating status ──────────────────────────────
  const STAGES = [
    'Mengenali platform…', 'Menghubungi sumber…', 'Membaca kualitas tersedia…', 'Menyiapkan link download…',
  ];
  let stageTimer = null;
  function showSkeleton() {
    zone.hidden = false;
    zone.innerHTML = `
      <div class="skel">
        <div class="skel-row">
          <div class="skel-thumb shimmer"></div>
          <div class="skel-lines">
            <div class="skel-line shimmer" style="width:82%"></div>
            <div class="skel-line shimmer" style="width:56%"></div>
            <div class="skel-line shimmer" style="width:38%"></div>
          </div>
        </div>
        <div class="skel-bar shimmer"></div>
        <div class="skel-status"><span class="spinner"></span><span id="stageText">${STAGES[0]}</span></div>
      </div>`;
    let i = 0;
    const label = $('#stageText');
    stageTimer = setInterval(() => { i = Math.min(i + 1, STAGES.length - 1); if (label) label.textContent = STAGES[i]; }, 1400);
    scrollToEl(zone);
  }
  const stopStages = () => { clearInterval(stageTimer); stageTimer = null; };

  function setLoading(on) {
    goBtn.classList.toggle('is-loading', on);
    goBtn.disabled = on;
    input.readOnly = on;
    form.setAttribute('aria-busy', String(on));
    $('#cancelBtn').hidden = !on;
    $('#pasteBtn').disabled = on;
    $('#clearInput').disabled = on;
  }

  // ── resolve ────────────────────────────────────────────────────────────
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  let activeRequest = null;
  $('#cancelBtn').addEventListener('click', () => activeRequest?.abort());
  async function submit(forcedUrl) {
    if (activeRequest) { toast('info', 'Satu per satu, ya', 'Tunggu proses selesai atau pilih Batalkan.'); return; }
    const raw = (forcedUrl || input.value).trim();
    let url = raw;
    if (!url) {
      formHint.classList.add('has-err');
      hint.textContent = 'Tempel dulu link yang ingin kamu simpan.';
      input.setAttribute('aria-invalid', 'true');
      shell.classList.add('is-shake');
      setTimeout(() => shell.classList.remove('is-shake'), 400);
      input.focus();
      return;
    }

    const parsed = parsePublicUrl(raw);
    if (!parsed) {
      formHint.classList.add('has-err');
      hint.textContent = 'Link belum valid. Gunakan alamat publik http:// atau https://.';
      input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    url = parsed.href; input.value = url; syncIcon();
    const controller = new AbortController(); activeRequest = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 120000);
    setLoading(true); showSkeleton();

    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      const data = await res.json();
      stopStages();

      if (!res.ok || !Array.isArray(data.items) || !data.items.length) {
        renderError(data.error || { title: 'Gagal memproses', message: 'Server membalas tanpa data.' }, url);
        return;
      }
      renderResult(data);
      pushHistory({ url, title: data.title, platform: data.platform, thumb: data.thumbnail });
      if (data.cached) toast('info', 'Diambil dari cache', 'Link ini baru saja diproses, jadi hasilnya instan.');
    } catch (err) {
      stopStages();
      renderError({
        code: timedOut ? 'TIMEOUT' : err.name === 'AbortError' ? 'CANCELLED' : 'NETWORK',
        title: timedOut ? 'Sumbernya belum merespons' : err.name === 'AbortError' ? 'Proses dibatalkan' : 'Koneksi sedang terputus',
        message: timedOut ? 'Proses melewati dua menit. Coba beberapa saat lagi.' : err.name === 'AbortError' ? 'Permintaan di browser dihentikan. Proses server mungkin masih menyelesaikan pekerjaan.' : 'Kami belum bisa terhubung ke server VELOX.',
        hint: 'Periksa link dan koneksimu, lalu coba lagi saat siap.',
      }, url);
    } finally {
      clearTimeout(timeout); activeRequest = null;
      setLoading(false);
    }
  }

  let activeCaption = { description: '', hashtags: [] };
  function captionPanel(d) {
    if (d.platform === 'spotify') { activeCaption = { description: '', hashtags: [] }; return ''; }
    const description = typeof d.description === 'string' ? d.description : typeof d.title === 'string' ? d.title : '';
    const tags = Array.isArray(d.hashtags) ? d.hashtags : [];
    activeCaption = { description, hashtags: [...new Set(tags.filter(t => typeof t === 'string' && t.length <= 200 && /^#[\p{L}\p{M}\p{N}_]+$/u.test(t)))] };
    const sourceNote = d.descriptionTruncated ? 'Teks sumber melebihi batas 50.000 karakter; bagian yang ditampilkan dapat disalin.' : !d.description || d.descriptionSource === 'title' ? 'Sumber hanya memberikan judul/teks singkat, bukan deskripsi lengkap.' : 'Teks yang tersedia dari sumber. Baris dan emoji tetap dipertahankan.';
    return `<section class="caption-panel" aria-labelledby="captionHeading">
      <header class="caption-heading"><div><span class="eyebrow">KEEP THE CONTEXT</span><h3 id="captionHeading">Simpan videonya. Salin ceritanya.</h3></div><span class="caption-count">${Array.from(description).length.toLocaleString('id-ID')} karakter</span></header>
      ${description ? `<label class="sr-only" for="captionText">Deskripsi atau teks dari sumber</label><textarea id="captionText" class="caption-text" readonly rows="4" spellcheck="false">${esc(description)}</textarea>` : '<p class="caption-empty">Sumber tidak menyediakan deskripsi untuk media ini.</p>'}
      ${description.length > 120 || description.split("\n").length > 3 ? '<button class="text-btn caption-expand" type="button" id="expandCaptionBtn" aria-expanded="false" aria-controls="captionText">Perluas teks ↓</button>' : ''}
      <p class="caption-source-note">${esc(sourceNote)}</p>
      <div class="caption-actions"><button class="mini-btn caption-copy" type="button" data-copy-caption="description" ${description ? '' : 'disabled'}><svg class="ico"><use href="#i-copy"/></svg>Salin deskripsi</button><button class="mini-btn" type="button" data-copy-caption="hashtags" ${activeCaption.hashtags.length ? '' : 'disabled'}># Salin hashtag <span>${activeCaption.hashtags.length}</span></button><button class="text-btn" type="button" id="saveCaptionBtn" ${description ? '' : 'disabled'}>Simpan .txt ↧</button></div>
      <div class="caption-tags" aria-label="Hashtag dari sumber">${activeCaption.hashtags.length ? activeCaption.hashtags.map(tag => `<button class="tag-copy" type="button" data-copy-tag="${esc(tag)}" aria-label="Salin hashtag ${esc(tag)}">${esc(tag)}</button>`).join('') : '<span class="caption-empty">Tidak ada hashtag dari sumber. Kami tidak menambahkan hashtag otomatis.</span>'}</div>
      ${activeCaption.hashtags.length ? `<label class="sr-only" for="hashtagText">Daftar hashtag untuk salin manual</label><input id="hashtagText" class="hashtag-text" readonly value="${esc(activeCaption.hashtags.join(' '))}" aria-label="Hashtag untuk salin manual">` : ''}
    </section>`;
  }

  // ── render result ──────────────────────────────────────────────────────
  function formatButton(f, idx) {
    const ico = f.kind === 'audio'
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
      : f.kind === 'image'
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>';
    return `<button class="fmt-btn" data-kind="${esc(f.kind)}" data-url="${esc(f.url)}" data-idx="${idx}">
      <span class="fmt-ico">${ico}</span>
      <span class="fmt-txt">
        <span class="fmt-label">${esc(f.label)}</span>
        <span class="fmt-sub">${esc([f.size, f.note].filter(Boolean).join(' · ') || f.ext?.toUpperCase() || 'Download')}</span>
      </span>
      <span class="fmt-tag" data-tag="${esc(f.tag || '')}">${esc(f.tag || 'FILE')}</span>
    </button>`;
  }

  const VIA = {
    'scrapr-spotisaver': 'scrapr · Spotisaver', 'scrapr-spotidown': 'scrapr · SpotiDown', 'scrapr-spotmate': 'scrapr · Spotimate',
    'scrapr-rapidsave': 'scrapr · RapidSave', 'scrapr-bilibili': 'scrapr · Bilibili API',
    'spotify-official': 'Spotify resmi', 'bluesky-public': 'Bluesky publik', 'reddit-public': 'Reddit publik',
    engine: 'yt-dlp', tikwm: 'TikWM', syndication: 'X API', embed: 'embed',
    'izuka-aio': 'API cadangan', 'izuka-ig': 'API cadangan', 'izuka-yt': 'API cadangan', 'izuka-ytmp4': 'API cadangan',
    'izuka-x': 'API cadangan', 'izuka-threads': 'API cadangan', 'azbry-fb': 'API cadangan', savefbs: 'AIO cadangan',
    'threads-worker': 'API cadangan', 'custom-api': 'API kustom',
  };
  const viaLabel = (v) => VIA[v] || v;

  function renderResult(d) {
    zone.hidden = false;
    const plat = d.platform || 'generic';
    const color = colorOf(plat);
    const hasFormats = d.items.some(it => it.formats?.length);
    let spotifySource = '';
    if (plat === 'spotify') { try { const u = new URL(d.sourceUrl || d.url); if (u.protocol === 'https:' && u.hostname === 'open.spotify.com' && !u.username && !u.password) spotifySource = u.href; } catch { /* no unsafe outbound link */ } }
    const vertical = /tiktok|instagram|snapchat|threads|rednote/i.test(plat);

    // group formats by kind, keep server ordering inside each group
    const groups = [
      { key: 'video', title: 'Video' },
      { key: 'audio', title: 'Audio' },
      { key: 'image', title: d.kind === 'gallery' ? 'Foto (slide)' : 'Foto' },
    ];

    const body = d.isPlaylist ? renderPlaylist(d) : groups.map((g) => {
      const list = (d.items || []).flatMap((it) => it.formats || []).filter((f) => (g.key === 'video' ? f.kind === 'video' : f.kind === g.key));
      if (!list.length) return '';
      return `<div class="fmt-section" data-format-group="${g.key}">
        <div class="fmt-head">${g.title} <span style="font-weight:500;letter-spacing:0;text-transform:none">· ${list.length} opsi</span></div>
        <div class="fmt-grid">${list.map((f, i) => formatButton(f, i)).join('')}</div>
      </div>`;
    }).join('');

    zone.innerHTML = `
      <div class="result-card">
        <div class="result-top">
          <div class="thumb-wrap ${vertical && !d.isPlaylist ? 'vertical' : ''}">
            <div class="thumb-fallback">${iconSvg(plat, 30)}</div>
            ${safeImage(d.thumbnail) ? `<img class="thumb-img" src="${esc(safeImage(d.thumbnail))}" alt="" referrerpolicy="no-referrer">` : ''}
            <span class="thumb-plat" style="color:${color}">${iconSvg(plat, 13)} ${esc(d.platformName || nameOf(plat))}</span>
            ${d.duration ? `<span class="thumb-dur">${esc(d.duration)}</span>` : ''}
          </div>
          <div class="result-meta">
            <h2 class="result-title">${esc(d.title || 'Media')}</h2>
            ${d.author ? `<p class="result-by">${esc(d.author)}</p>` : ''}
            <div class="result-stats">
              ${d.via ? `<span class="chip via" title="metode: ${esc(d.via)}">via ${esc(viaLabel(d.via))}</span>` : ''}
              ${d.views ? `<span class="chip">👁 ${d.views.toLocaleString('id-ID')}</span>` : ''}
              ${d.likes ? `<span class="chip">♥ ${d.likes.toLocaleString('id-ID')}</span>` : ''}
              ${d.isPlaylist ? `<span class="chip good">${d.count} item playlist</span>` : ''}
              ${!d.isPlaylist ? `<span class="chip good">${hasFormats ? '✓ Format ditemukan' : 'Info tersedia · tanpa file audio'}</span>` : ''}
              <span class="chip">${esc(typeof d.ms === 'number' ? `${d.ms} ms` : 'cepat')}</span>
            </div>
            ${(d.warnings || []).map((w) => `<div class="warn-note"><span>⚠</span><span>${esc(w.text || w)}</span></div>`).join('')}
          </div>
        </div>
        ${plat === 'spotify' ? `<div class="spotify-result-note"><div><span class="eyebrow">SPOTIFY / ${esc(({track:'LAGU',album:'ALBUM',playlist:'PLAYLIST'})[d.contentType] || 'INFO')}</span><p>${esc(d.notice || 'Info dan preview resmi jika tersedia. Bukan unduhan lagu penuh.')}</p></div>${spotifySource ? `<a class="spotify-source" href="${esc(spotifySource)}" target="_blank" rel="noopener noreferrer">Buka Spotify ↗</a>` : ''}</div>` : ''}
        ${!d.isPlaylist && hasFormats ? `<div class="result-filter" aria-label="Filter format"><button class="filter-btn" type="button" data-filter="all" aria-pressed="true">Semua format</button>${groups.filter(g => d.items.some(it => it.formats?.some(f => f.kind === g.key))).map(g => `<button class="filter-btn" type="button" data-filter="${g.key}" aria-pressed="false">${g.title}</button>`).join('')}</div>` : ''}
        ${body || (plat === 'spotify' ? '' : '<p class="empty-search">Belum ada format yang bisa diunduh dari link ini. Coba konten lain.</p>')}
        ${captionPanel(d)}
      </div>`;
    // broken thumbnails simply vanish, revealing the platform fallback behind them
    zone.querySelectorAll('img.thumb-img, img.pl-thumb').forEach((img) => {
      img.addEventListener('error', () => { img.remove(); }, { once: true });
    });
    scrollToEl(zone);
  }

  function renderPlaylist(d) {
    return `<div class="fmt-section">
      <div class="fmt-head">Item playlist · ${d.items.length} video</div>
      <div class="pl-list">
        ${d.items.map((it, i) => `
          <div class="pl-row">
            <div class="pl-thumb">${it.thumbnail ? `<img class="pl-thumb" src="${esc(it.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</div>
            <div class="pl-info">
              <div class="pl-title">${i + 1}. ${esc(it.title)}</div>
              <div class="pl-sub">${esc(it.duration || 'Video')}</div>
            </div>
            <div class="pl-acts">
              ${(it.formats || []).map((f) => `<button class="mini-btn" data-url="${esc(f.url)}" data-kind="${esc(f.kind)}">${esc(f.kind === 'audio' ? 'MP3' : 'MP4')}</button>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  function renderError(err, url) {
    zone.hidden = false;
    zone.innerHTML = `
      <div class="err-card">
        <div class="err-head"><span class="err-ico">!</span><span>${esc(err.title || 'Gagal memproses')}</span></div>
        <p class="err-msg">${esc(err.message || 'Terjadi kesalahan yang tidak diketahui.')}</p>
        ${err.hint ? `<div class="err-hint">💡 <b>Saran:</b> ${esc(err.hint)}</div>` : ''}
        <div class="err-acts">
          <button class="mini-btn" id="retryBtn">↻ Coba lagi</button>
          <button class="mini-btn" id="copyUrlBtn">Salin link</button>
        </div>
        ${err.code ? `<p class="err-code" style="margin-top:12px">kode: ${esc(err.code)}</p>` : ''}
      </div>`;
    $('#retryBtn').addEventListener('click', () => submit(url));
    $('#copyUrlBtn').addEventListener('click', () => copyText(url));
    scrollToEl(zone);
  }

  // ── downloads (streamed via fetch so failures become toasts, not junk files)
  function filenameFrom(cd, fallback) {
    if (!cd) return fallback;
    const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (star) { try { return decodeURIComponent(star[1]); } catch { /* fall through */ } }
    const plain = cd.match(/filename="?([^";]+)"?/i);
    return plain ? plain[1] : fallback;
  }

  async function download(btn) {
    const url = btn.dataset.url;
    if (!url || btn.classList.contains('is-busy')) return;
    // Resolver download URLs must point back to this application's download route.
    try { const u = new URL(url, location.origin); if (u.origin !== location.origin || u.pathname !== '/api/dl') throw new Error(); }
    catch { toast('err', 'Link unduhan tidak valid', 'Proses ulang link sumber untuk mendapatkan URL baru.'); return; }
    btn.disabled = true;
    const sub = btn.querySelector('.fmt-sub');
    const originalSub = sub ? sub.textContent : '';
    btn.classList.add('is-busy');
    if (sub) sub.textContent = 'Menyiapkan…';

    try {
      const res = await fetch(url);
      const ct = res.headers.get('content-type') || '';

      if (ct.includes('application/json')) {
        const j = await res.json().catch(() => ({}));
        const e = j.error || {};
        throw Object.assign(new Error(e.message || 'Gagal mengambil file'), { title: e.title, hint: e.hint });
      }
      if (!res.ok || !res.body) throw Object.assign(new Error(`Server membalas HTTP ${res.status}`), { title: 'Download gagal' });

      const total = Number(res.headers.get('content-length')) || 0;
      const name = filenameFrom(res.headers.get('content-disposition'), 'velox-media');

      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        if (sub) sub.textContent = total ? `${Math.round((got / total) * 100)}% · ${(got / 1048576).toFixed(1)} MB` : `${(got / 1048576).toFixed(1)} MB`;
      }

      const blob = new Blob(chunks, { type: ct || 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);

      if (sub) sub.textContent = `✓ ${(blob.size / 1048576).toFixed(1)} MB tersimpan`;
      toast('ok', 'Download selesai', name, 3600);
      setTimeout(() => { if (sub) sub.textContent = originalSub; }, 3200);
    } catch (err) {
      if (sub) sub.textContent = originalSub;
      toast('err', err.title || 'Download gagal', err.message || String(err), 5200);
    } finally {
      btn.classList.remove('is-busy');
      btn.disabled = false;
    }
  }

  zone.addEventListener('click', (e) => {
    const expand = e.target.closest('#expandCaptionBtn');
    if (expand) { const open = $('#captionText').classList.toggle('is-expanded'); expand.setAttribute('aria-expanded', String(open)); expand.textContent = open ? 'Ringkas tampilan ↑' : 'Perluas teks ↓'; return; }
    const copy = e.target.closest('[data-copy-caption]');
    if (copy) { const isTags = copy.dataset.copyCaption === 'hashtags'; copyText(isTags ? activeCaption.hashtags.join(' ') : activeCaption.description, isTags ? 'Hashtag tersalin' : 'Deskripsi tersalin'); return; }
    const tag = e.target.closest('[data-copy-tag]');
    if (tag) { copyText(tag.dataset.copyTag, 'Hashtag tersalin'); return; }
    if (e.target.closest('#saveCaptionBtn')) {
      if (!activeCaption.description) return;
      const href = URL.createObjectURL(new Blob([activeCaption.description], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a'); a.href = href; a.download = 'velox-deskripsi.txt'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5000); toast('ok', 'File teks disiapkan'); return;
    }
    const filter = e.target.closest('[data-filter]');
    if (filter) {
      $$('[data-filter]', zone).forEach(b => b.setAttribute('aria-pressed', String(b === filter)));
      $$('[data-format-group]', zone).forEach(el => { el.hidden = filter.dataset.filter !== 'all' && el.dataset.formatGroup !== filter.dataset.filter; });
    }
    const btn = e.target.closest('[data-url]');
    if (btn) download(btn);
  });

  // ── platform grid ──────────────────────────────────────────────────────
  function pickPlatform(id) {
    const p = PLATFORMS.find(p => p.id === id); if (!p) return;
    input.placeholder = `Tempel link publik dari ${p.name}…`;
    if (!input.value) { hint.textContent = p.id === 'spotify' ? 'Spotify dipilih · tempel link lagu, album, atau playlist.' : `${p.name} dipilih. Salin link kontenmu, lalu tempel di sini.`; $('#spotifyInputNote').hidden = p.id !== 'spotify'; }
    scrollToEl(form); input.focus({ preventScroll: true });
  }
  function renderPlatforms() {
    $('#platformGrid').innerHTML = PLATFORMS.map((p) => `
      <button class="plat-card" style="--pc:${p.color}" data-platform="${p.id}" aria-label="Gunakan ${esc(p.name)}" title="Tempel link milikmu dari ${esc(p.name)}">
        ${p.isNew ? '<span class="plat-new">BARU</span>' : '<span class="plat-arrow" aria-hidden="true">↗</span>'}
        <span class="plat-ico">${iconSvg(p.id, 21)}</span>
        <span class="plat-name">${esc(p.name)}</span>
        <span class="plat-kinds">${esc(p.kinds)}</span>
      </button>`).join('');
    $('#platformGrid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-platform]'); if (card) pickPlatform(card.dataset.platform);
    });
    $('#quickPlatforms').innerHTML = '<span class="quick-label">COCOK UNTUK</span>' + ['spotify', 'tiktok', 'instagram', 'youtube', 'twitter'].map(id => PLATFORMS.find(p => p.id === id)).map(p => `<button class="quick-btn" type="button" data-platform="${p.id}">${iconSvg(p.id, 14)} ${esc(p.name)}</button>`).join('') + '<a class="quick-more" href="#platforms">+14 lainnya ↗</a>';
    $('#quickPlatforms').addEventListener('click', e => { const b = e.target.closest('[data-platform]'); if (b) pickPlatform(b.dataset.platform); });
    let platformFilter = 'all';
    function filterPlatforms() {
      const q = $('#platformSearch').value.trim().toLowerCase(); let visible = 0;
      $$('.plat-card').forEach(card => {
        const p = PLATFORMS.find(p => p.id === card.dataset.platform);
        card.hidden = !card.textContent.toLowerCase().includes(q) || (platformFilter === 'new' && !p.isNew) || (platformFilter === 'music' && !['spotify', 'soundcloud'].includes(p.id));
        if (!card.hidden) visible++;
      });
      $('#platformEmpty').hidden = visible > 0;
      $('#platformVisible').textContent = `${visible} dari ${PLATFORMS.length} integrasi`;
    }
    $('#platformSearch').addEventListener('input', filterPlatforms);
    $('#platformFilters').addEventListener('click', e => {
      const btn = e.target.closest('[data-platform-filter]'); if (!btn) return;
      platformFilter = btn.dataset.platformFilter;
      $$('[data-platform-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      filterPlatforms();
    });
    $('#spotifyStart').addEventListener('click', () => pickPlatform('spotify'));
    filterPlatforms();
  }

  // ── api tabs + base url ────────────────────────────────────────────────
  function initApi() {
    $$('.api-base').forEach((el) => { el.textContent = location.origin === 'null' ? '' : location.origin; });
    function activate(tab) {
      $$('.api-tab').forEach(t => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', String(t === tab)); t.tabIndex = t === tab ? 0 : -1; });
      $$('.api-pane').forEach(p => { p.classList.toggle('is-active', p.id === tab.dataset.pane); p.hidden = p.id !== tab.dataset.pane; });
    }
    $('.api-tabs').addEventListener('click', e => { const tab = e.target.closest('.api-tab'); if (tab) activate(tab); });
    $('.api-tabs').addEventListener('keydown', e => {
      const tabs = $$('.api-tab'); let i = tabs.indexOf(document.activeElement);
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      i = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activate(tabs[i]); tabs[i].focus();
    });
    $('#copyApiBtn').addEventListener('click', () => copyText($('.api-pane.is-active pre').textContent));
  }
  function initStudio() {
    const themeBtn = $('#themeBtn');
    function themeLabel() { const light = document.documentElement.dataset.theme === 'light'; themeBtn.setAttribute('aria-label', `Ganti ke tema ${light ? 'gelap' : 'terang'}`); themeBtn.title = themeBtn.getAttribute('aria-label'); document.querySelector('meta[name="theme-color"]').content = light ? '#f5f5ef' : '#101110'; }
    themeLabel();
    themeBtn.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('velox.theme.v2', theme); } catch { /* optional */ }
      themeLabel();
    });
    $$('.side-nav a').forEach(link => link.addEventListener('click', () => { $$('.side-nav a').forEach(a => a.classList.toggle('is-active', a === link)); }));
    window.addEventListener('storage', e => { if (e.key === HKEY) renderHistory(); });
  }

  // ── health ─────────────────────────────────────────────────────────────
  async function pingHealth() {
    try {
      const res = await fetch('/api/health');
      const j = await res.json();
      const ok = j.status === 'ok';
      statusPill.dataset.state = ok ? 'ok' : 'bad';
      statusText.textContent = ok ? 'Engine online' : 'Engine terbatas';
      statusPill.title = `Engine: yt-dlp ${j.engine?.version || '?'} · ffmpeg ${j.engine?.ffmpeg ? 'aktif' : 'tidak ada'} · cache ${j.cache?.entries ?? 0} entri`;
      $('#footEngine').textContent = `yt-dlp ${j.engine?.version || ''}`.trim();
      $('#footPlatforms').textContent = j.platforms || PLATFORMS.length;
    } catch {
      statusPill.dataset.state = 'bad';
      statusText.textContent = 'offline';
    }
  }

  // ── reveal on scroll ───────────────────────────────────────────────────
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px' });
    els.forEach((e) => io.observe(e));
  }

  // ── boot ───────────────────────────────────────────────────────────────
  syncIcon();
  renderPlatforms();
  renderHistory();
  initApi();
  initStudio();
  initReveal();
  pingHealth();
  setInterval(pingHealth, 60_000);

  // expose for debugging in the console without polluting globals elsewhere
  window.VELOX = { resolve: submit, history: readHistory, platforms: PLATFORMS };
})();

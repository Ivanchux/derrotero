/* Derrotero · buscador de elementos del mapa y de direcciones (Nominatim de OpenStreetMap) */
(function () {
  'use strict';
  const D = window.Derrotero;
  const $ = D.$;
  const esc = D.esc;
  const S = (D.search = {});
  let entries = []; // lista plana de filas navegables
  let active = 0;
  let addr = { state: 'idle', q: '', list: [] };
  let lastQ = '';
  const view = () => D.state.mode === 'view';

  function localMatches(q) {
    const nq = D.norm(q).trim();
    if (!nq) return [];
    const tokens = nq.split(/\s+/);
    const out = [];
    D.state.project.items.forEach((it) => {
      const cat = D.catById(it.categoryId);
      const title = D.norm(it.title);
      const hay = [title, it.tags.map(D.norm).join(' '), D.norm(cat && cat.name), D.norm(D.htmlToText(it.description))].join(' ');
      if (!tokens.every((t) => hay.includes(t))) return;
      let s = 0;
      if (title === nq) s += 100;
      else if (title.startsWith(nq)) s += 80;
      else if (tokens.every((t) => title.includes(t))) s += 60;
      else if (it.tags.some((t) => D.norm(t).includes(nq))) s += 45;
      else s += 20;
      out.push({ it, s });
    });
    return out.sort((a, b) => b.s - a.s).slice(0, 7).map((x) => x.it);
  }

  function render() {
    const q = $('#searchInput').value.trim();
    const box = $('#searchResults');
    $('#searchClear').hidden = !q;
    if (!q) { box.classList.remove('is-open'); entries = []; return; }
    const locals = localMatches(q);
    entries = [];
    let html = '';
    if (locals.length) {
      html += '<p class="sr__h">En el mapa</p>';
      locals.forEach((it) => {
        const st = D.styleOf(it);
        const cat = D.catById(it.categoryId);
        entries.push({ kind: 'item', id: it.id });
        html += `<button class="sr" data-n="${entries.length - 1}"><span class="sr__ic" style="--c:${esc(st.color)}">${D.icon(it.type === 'point' ? st.icon : it.type === 'line' ? 'spline' : 'pentagon', 16)}</span><span class="sr__t"><b>${esc(it.title)}</b><small>${esc(cat ? cat.name : '')}${it.tags.length ? ' · ' + esc(it.tags.slice(0, 3).map((t) => '#' + t).join(' ')) : ''}</small></span></button>`;
      });
    }
    if (!view()) {
      html += '<p class="sr__h">Direcciones y lugares</p>';
      if (addr.state === 'idle' || addr.q !== q) {
        entries.push({ kind: 'addr-go' });
        html += `<button class="sr sr--go" data-n="${entries.length - 1}"><span class="sr__ic">${D.icon('navigation', 16)}</span><span class="sr__t"><b>Buscar «${esc(q)}» como dirección</b><small>Pulsa Intro · usa OpenStreetMap</small></span><kbd>↵</kbd></button>`;
      } else if (addr.state === 'loading') html += '<p class="sr__msg"><span class="spin"></span> Buscando…</p>';
      else if (addr.state === 'error') html += '<p class="sr__msg is-err">No se pudo consultar el buscador de direcciones. Comprueba la conexión.</p>';
      else if (!addr.list.length) html += '<p class="sr__msg">Sin resultados para esa dirección.</p>';
      else
        addr.list.forEach((r) => {
          entries.push({ kind: 'addr', r });
          const parts = String(r.display_name).split(',');
          html += `<button class="sr" data-n="${entries.length - 1}"><span class="sr__ic">${D.icon('map-pin', 16)}</span><span class="sr__t"><b>${esc(parts[0])}</b><small>${esc(parts.slice(1, 4).join(',').trim())}</small></span></button>`;
        });
    } else if (!locals.length) html += '<p class="sr__msg">Sin resultados.</p>';
    box.innerHTML = html;
    box.classList.add('is-open');
    if (active >= entries.length) active = 0;
    paintActive();
  }
  function paintActive() {
    D.$$('#searchResults .sr').forEach((b) => b.classList.toggle('is-active', +b.dataset.n === active));
    const a = $('#searchResults .sr.is-active');
    if (a) a.scrollIntoView({ block: 'nearest' });
  }

  async function runAddress(q) {
    addr = { state: 'loading', q, list: [] };
    render();
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=es&q=' + encodeURIComponent(q);
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      addr = { state: 'done', q, list: await r.json() };
    } catch (e) {
      console.warn('[Derrotero] búsqueda de direcciones', e);
      addr = { state: 'error', q, list: [] };
    }
    if ($('#searchInput').value.trim() === q) { active = 0; render(); if (entries.length) { active = entries.findIndex((x) => x.kind === 'addr'); if (active < 0) active = 0; paintActive(); } }
  }

  function choose(n) {
    const e = entries[n];
    if (!e) return;
    if (e.kind === 'item') {
      close(true);
      D.ui.focusItem(e.id);
    } else if (e.kind === 'addr-go') runAddress($('#searchInput').value.trim());
    else if (e.kind === 'addr') {
      const r = e.r;
      const ll = [+r.lat, +r.lon];
      close(false);
      const parts = String(r.display_name).split(',');
      const m = D.map.map;
      if (r.boundingbox) {
        const [s, n2, w, ea] = r.boundingbox.map(Number);
        m.flyToBounds([[s, w], [n2, ea]], { maxZoom: 17, duration: 1.8, paddingBottomRight: [D.map.insets().r, 0] });
      } else m.flyTo(ll, 16, { duration: 1.8 });
      const html = `<div class="pop"><b>${esc(parts[0])}</b><small>${esc(parts.slice(1).join(',').trim())}</small><div class="pop__act">${D.state.mode === 'edit' ? '<button class="btn btn--sm btn--primary" data-pop="add">Añadir como punto</button>' : ''}<button class="btn btn--sm" data-pop="rm">Quitar</button></div></div>`;
      const mk = D.map.showTemp(ll, html);
      mk.on('popupopen', (ev) => {
        const el = ev.popup.getElement();
        el.addEventListener('click', (c) => {
          const b = c.target.closest('[data-pop]');
          if (!b) return;
          if (b.dataset.pop === 'add') {
            D.map.clearTemp();
            D.emit('draw-complete', { type: 'point', coords: ll });
            setTimeout(() => { const t = $('#edTitle'); if (t && !t.value) { t.value = parts[0]; t.dispatchEvent(new Event('input')); } }, 450);
          } else D.map.clearTemp();
        });
      });
    }
  }
  function close(clear) {
    $('#searchResults').classList.remove('is-open');
    if (clear) { $('#searchInput').value = ''; $('#searchClear').hidden = true; addr = { state: 'idle', q: '', list: [] }; }
    $('#searchInput').blur();
  }

  S.init = () => {
    const inp = $('#searchInput');
    if (view() && D.state.viewOptions.search === false) $('#searchBox').hidden = true;
    inp.addEventListener('input', () => { active = 0; if (addr.q !== inp.value.trim()) addr.state = 'idle'; render(); });
    inp.addEventListener('focus', () => { if (inp.value.trim()) render(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(entries.length - 1, active + 1); paintActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paintActive(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const q = inp.value.trim();
        if ((e.ctrlKey || e.metaKey) && !view() && q) return runAddress(q);
        choose(active);
      } else if (e.key === 'Escape') { e.stopPropagation(); if (inp.value) { inp.value = ''; render(); } else close(true); }
    });
    $('#searchResults').addEventListener('mousedown', (e) => e.preventDefault());
    $('#searchResults').addEventListener('click', (e) => { const b = e.target.closest('.sr'); if (b) choose(+b.dataset.n); });
    $('#searchResults').addEventListener('mousemove', (e) => { const b = e.target.closest('.sr'); if (b && +b.dataset.n !== active) { active = +b.dataset.n; paintActive(); } });
    $('#searchClear').onclick = () => { inp.value = ''; render(); inp.focus(); };
    document.addEventListener('mousedown', (e) => { if (!$('#searchBox').contains(e.target)) $('#searchResults').classList.remove('is-open'); });
    D.on('project', () => close(true));
  };
})();

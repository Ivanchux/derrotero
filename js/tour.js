/* Derrotero · recorrido: editor de paradas y modo presentación con vuelo entre puntos */
(function () {
  'use strict';
  const D = window.Derrotero;
  const L = window.L;
  const $ = D.$;
  const esc = D.esc;
  const T = (D.tour = {});
  const view = () => D.state.mode === 'view';
  let active = false, index = -1, playing = false, timer = null, token = 0, segs = [], routeGroup = null, sbWasOpen = true;

  const steps = () => D.state.project.tour.steps.map((s) => ({ s, it: D.itemById(s.itemId) })).filter((x) => x.it);
  const stPos = (it) => (it.type === 'point' ? it.coords : D.geo.centroid(it.coords));

  /* ======================== Editor (pestaña Recorrido) ======================== */
  function renderTab() {
    const root = $('#tab-tour');
    const p = D.state.project;
    const list = steps();
    const set = p.settings;
    const mins = Math.max(1, Math.round((list.length * (set.stepDelay + set.flyDuration)) / 60));
    const edit = !view();
    const rest = p.items.filter((i) => !p.tour.steps.some((s) => s.itemId === i.id));
    root.innerHTML = `
      <div class="sec"><div class="tourcta">
        <div><b>${list.length} parada${list.length === 1 ? '' : 's'}</b><small>${list.length ? `≈ ${mins} min con avance automático` : 'Añade paradas para presentar'}</small></div>
        <button class="btn btn--primary" data-act="present" ${p.items.length ? '' : 'disabled'}>${D.icon('play', 16)}Presentar</button></div></div>
      <div class="sec"><div class="sec__head"><h3>Orden de las paradas</h3>${edit ? `<div class="sec__tools"><button class="icon-btn icon-btn--sm" data-act="add-all" title="Añadir todos los elementos">${D.icon('copy-plus', 16)}</button><button class="icon-btn icon-btn--sm" data-act="clear" title="Vaciar recorrido">${D.icon('trash-2', 16)}</button></div>` : ''}</div>
        ${list.length ? `<ol class="steps">${list.map(({ it }, i) => {
          const st = D.styleOf(it);
          return `<li class="step" data-i="${i}" ${edit ? 'draggable="true"' : ''}>${edit ? `<span class="step__grip">${D.icon('grip-vertical', 16)}</span>` : ''}<span class="step__n">${i + 1}</span><button class="step__t" data-act="go"><i style="background:${esc(st.color)}"></i><span>${esc(it.title)}</span></button>${edit ? `<span class="step__act"><button data-act="up" title="Subir" ${i === 0 ? 'disabled' : ''}>${D.icon('chevron-up', 15)}</button><button data-act="down" title="Bajar" ${i === list.length - 1 ? 'disabled' : ''}>${D.icon('chevron-down', 15)}</button><button data-act="rm" title="Quitar">${D.icon('x', 15)}</button></span>` : ''}</li>`;
        }).join('')}</ol>` : `<div class="empty empty--sm"><p>${edit ? 'Todavía no hay paradas. Añade elementos aquí abajo, desde su ficha con el botón de ruta, o todos de golpe.' : 'Este mapa no tiene recorrido.'}</p></div>`}
        ${edit && rest.length ? `<select class="addstep" id="addStep"><option value="">+ Añadir una parada…</option>${rest.map((i) => `<option value="${i.id}">${esc(i.title)}</option>`).join('')}</select>` : ''}
      </div>
      ${edit ? `<div class="sec"><div class="sec__head"><h3>Ajustes de la presentación</h3></div>
        <label class="field field--range"><span>Duración del vuelo <em id="tvFly">${set.flyDuration.toLocaleString('es-ES')} s</em></span><input type="range" id="tsFly" min="0.8" max="6" step="0.2" value="${set.flyDuration}"></label>
        <label class="field field--range"><span>Pausa en cada parada (avance automático) <em id="tvDelay">${set.stepDelay} s</em></span><input type="range" id="tsDelay" min="3" max="30" step="1" value="${set.stepDelay}"></label>
        <label class="field field--range"><span>Zoom al llegar a un punto <em id="tvZoom">${set.tourZoom}</em></span><input type="range" id="tsZoom" min="12" max="19" step="1" value="${set.tourZoom}"></label>
        <div class="row"><div><b>Dibujar la ruta entre paradas</b><small>Línea de latón que avanza con el recorrido</small></div><div id="tsRoute"></div></div>
        <div class="row"><div><b>Diapositiva de portada</b><small>Muestra título y descripción al empezar</small></div><div id="tsIntro"></div></div>
      </div>` : ''}`;
    if (edit) {
      $('#tsRoute', root).appendChild(D.ui.switchEl(set.route, (v) => D.store.setSettings({ route: v })));
      $('#tsIntro', root).appendChild(D.ui.switchEl(set.intro, (v) => D.store.setSettings({ intro: v })));
      const bindRange = (id, lab, key, fmt) => {
        const r = $(id, root);
        r.addEventListener('input', () => { $(lab, root).textContent = fmt(+r.value); });
        r.addEventListener('change', () => D.store.setSettings({ [key]: +r.value }));
      };
      bindRange('#tsFly', '#tvFly', 'flyDuration', (v) => v.toLocaleString('es-ES') + ' s');
      bindRange('#tsDelay', '#tvDelay', 'stepDelay', (v) => v + ' s');
      bindRange('#tsZoom', '#tvZoom', 'tourZoom', (v) => String(v));
    }
  }
  function bindTab() {
    const root = $('#tab-tour');
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const li = b.closest('.step');
      const i = li ? +li.dataset.i : -1;
      const act = b.dataset.act;
      const arr = D.state.project.tour.steps.slice();
      const real = (n) => D.state.project.tour.steps.findIndex((s) => s.itemId === steps()[n].it.id);
      if (act === 'present') T.start();
      else if (act === 'go') { if (view()) T.start(i); else D.ui.focusItem(steps()[i].it.id); }
      else if (act === 'rm') { arr.splice(real(i), 1); D.store.setSteps(arr); }
      else if (act === 'up' || act === 'down') {
        const j = act === 'up' ? i - 1 : i + 1;
        const list = steps().map((x) => x.s);
        [list[i], list[j]] = [list[j], list[i]];
        D.store.setSteps(list);
      } else if (act === 'add-all') {
        const have = new Set(arr.map((s) => s.itemId));
        const add = D.state.project.items.filter((it) => !have.has(it.id)).map((it) => ({ itemId: it.id, zoom: null }));
        if (!add.length) return D.toast('Todos los elementos ya están en el recorrido');
        D.store.setSteps(arr.concat(add));
      } else if (act === 'clear') {
        if (arr.length && (await D.confirm({ title: 'Vaciar el recorrido', text: 'Se quitarán todas las paradas. Los elementos del mapa no se tocan.', ok: 'Vaciar', danger: true }))) D.store.setSteps([]);
      }
    });
    root.addEventListener('change', (e) => { if (e.target.id === 'addStep' && e.target.value) { const arr = D.state.project.tour.steps.slice(); arr.push({ itemId: e.target.value, zoom: null }); D.store.setSteps(arr); } });
    // arrastrar y soltar
    let from = -1;
    root.addEventListener('dragstart', (e) => { const li = e.target.closest('.step'); if (!li) return; from = +li.dataset.i; li.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(from)); } catch (x) { /* ignora */ } });
    root.addEventListener('dragend', () => { from = -1; D.$$('.step', root).forEach((l) => l.classList.remove('is-drag', 'is-over')); });
    root.addEventListener('dragover', (e) => { const li = e.target.closest('.step'); if (!li || from < 0) return; e.preventDefault(); D.$$('.step', root).forEach((l) => l.classList.toggle('is-over', l === li && +l.dataset.i !== from)); });
    root.addEventListener('drop', (e) => {
      const li = e.target.closest('.step');
      if (!li || from < 0) return;
      e.preventDefault();
      const to = +li.dataset.i;
      if (to === from) return;
      const list = steps().map((x) => x.s);
      const [m] = list.splice(from, 1);
      list.splice(to, 0, m);
      D.store.setSteps(list);
    });
  }

  /* ======================== Presentación ======================== */
  function stepCount() { return steps().length; }
  function itemsOf() { return steps().map((x) => x.it); }

  T.start = async (from) => {
    if (active) return;
    if (D.state.editing) return D.toast('Termina de editar antes de presentar', { kind: 'warn' });
    if (!stepCount()) {
      const items = D.state.project.items;
      if (!items.length) return D.toast('Añade algún punto para poder presentar', { kind: 'warn' });
      if (view()) return D.toast('Este mapa no tiene recorrido', { kind: 'warn' });
      const ok = await D.confirm({ title: 'El recorrido está vacío', text: `¿Quieres usar los ${items.length} elementos del mapa, en el orden en que aparecen en la lista, como paradas?`, ok: 'Usar todos' });
      if (!ok) { D.ui.setTab('tour'); return; }
      D.store.setSteps(items.map((it) => ({ itemId: it.id, zoom: null })));
    }
    active = true;
    D.state.touring = true;
    sbWasOpen = !$('#sidebar').classList.contains('is-collapsed');
    D.tools && D.tools.set('select');
    D.ui.closePopover();
    D.map.clearTemp();
    D.map.select(null);
    D.ui.closeDetail();
    document.body.classList.add('is-tour');
    routeGroup = L.layerGroup().addTo(D.map.map);
    segs = [];
    $('#tourPanel').classList.add('is-open');
    $('#tourBar').classList.add('is-open');
    $('#tourExit').classList.add('is-open');
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => D.map.map.invalidateSize(), 480);
    const first = typeof from === 'number' ? from : D.state.project.settings.intro ? -1 : 0;
    go(first, { instant: true });
  };

  T.stop = () => {
    if (!active) return;
    active = false;
    playing = false;
    clearTimeout(timer);
    token++;
    D.state.touring = false;
    document.removeEventListener('keydown', onKey, true);
    document.body.classList.remove('is-tour');
    $('#tourPanel').classList.remove('is-open');
    $('#tourBar').classList.remove('is-open');
    $('#tourExit').classList.remove('is-open');
    D.map.forceVisible(null);
    D.map.select(null);
    if (routeGroup) { D.map.map.removeLayer(routeGroup); routeGroup = null; }
    segs = [];
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setTimeout(() => D.map.map.invalidateSize(), 480);
    index = -1;
  };

  function onKey(e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if ($('#lightbox').classList.contains('is-open')) return;
    const n = stepCount();
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); T.stop(); }
    else if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === ' ') { e.preventDefault(); toggle(); }
    else if (k === 'Home') { e.preventDefault(); go(D.state.project.settings.intro ? -1 : 0); }
    else if (k === 'End') { e.preventDefault(); go(n); }
    else if (k.toLowerCase() === 'f') { e.preventDefault(); fullscreen(); }
  }
  const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); };
  const next = () => { const n = stepCount(); if (index < n) go(index + 1); };
  const prev = () => { const min = D.state.project.settings.intro ? -1 : 0; if (index > min) go(index - 1); };
  function toggle() {
    playing = !playing;
    if (playing && index >= stepCount()) return go(D.state.project.settings.intro ? -1 : 0, {});
    if (playing) schedule(0); else { clearTimeout(timer); renderBar(); }
    renderBar();
  }
  function schedule(extra) {
    clearTimeout(timer);
    if (!playing) return;
    const ms = D.state.project.settings.stepDelay * 1000 + extra;
    const bar = $('#tourBar .tb__prog i');
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = `tbprog ${ms}ms linear forwards`; }
    timer = setTimeout(() => { if (index < stepCount()) next(); else { playing = false; renderBar(); } }, ms);
  }

  /* ---- Navegación a una diapositiva ---- */
  async function go(i, { instant = false } = {}) {
    const n = stepCount();
    const min = D.state.project.settings.intro ? -1 : 0;
    i = D.clamp(i, min, n);
    const my = ++token;
    clearTimeout(timer);
    const prevIdx = index;
    index = i;
    const set = D.state.project.settings;
    const dur = instant ? 0.01 : set.flyDuration;
    const list = steps();
    const panel = $('#tourPanel');
    renderBar();
    // 1· el panel anterior se retira
    panel.classList.add('is-out');
    let flight;
    if (i >= 0 && i < n) {
      const { s, it } = list[i];
      D.map.forceVisible(it.id);
      D.state.selectedId = null;
      D.map.select(it.id);
      updateRoute(i, prevIdx, dur);
      flight = D.map.flyToItem(it, { duration: dur, zoom: it.type === 'point' ? s.zoom || set.tourZoom : s.zoom || undefined });
    } else {
      D.map.forceVisible(null);
      D.map.select(null);
      updateRoute(i === -1 ? -1 : n - 1, prevIdx, dur);
      flight = D.map.fitItems(itemsOf(), { animate: !instant, duration: instant ? 0.01 : Math.max(1.4, dur) });
    }
    // 2· el nuevo se muestra hacia el final del vuelo
    await new Promise((r) => setTimeout(r, instant ? 30 : Math.min(dur * 1000 * 0.62, 1800)));
    if (my !== token) return;
    renderPanel(i);
    panel.classList.remove('is-out');
    await flight;
    if (my !== token) return;
    if (i >= 0 && i < n) D.map.pulseAt(stPos(list[i].it), D.styleOf(list[i].it).color);
    schedule(0);
    if (i === n && playing) { playing = false; clearTimeout(timer); renderBar(); }
  }

  function updateRoute(i, prevIdx, dur) {
    if (!routeGroup) return;
    const set = D.state.project.settings;
    const list = steps();
    const pts = list.map((x) => stPos(x.it));
    segs.forEach((sg, k) => { if (sg && k > i) { routeGroup.removeLayer(sg); segs[k] = null; } });
    if (!set.route) return;
    for (let k = 1; k <= i; k++) {
      if (segs[k]) continue;
      const a = pts[k - 1], b = pts[k];
      const line = L.polyline([a, a], { color: '#C9A862', weight: 3.5, opacity: 0.95, dashArray: '2 10', lineCap: 'round', className: 'dr-route', interactive: false }).addTo(routeGroup);
      segs[k] = line;
      if (k === i && prevIdx === i - 1 && dur > 0.1) {
        const t0 = performance.now(), ms = dur * 1000 * 0.9;
        const step = (t) => {
          const f = Math.min(1, (t - t0) / ms);
          const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
          line.setLatLngs([a, [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]]);
          if (f < 1 && segs[k] === line) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      } else line.setLatLngs([a, b]);
    }
  }

  /* ---- Panel y barra ---- */
  function renderPanel(i) {
    const p = D.state.project;
    const list = steps();
    const n = list.length;
    const panel = $('#tourPanel');
    let html;
    if (i === -1) {
      html = `<div class="tp__cover">
        <span class="eyebrow">${D.icon('route', 14)}Recorrido · ${n} parada${n === 1 ? '' : 's'}</span>
        <h1 class="tp__h1">${esc(p.meta.title)}</h1>
        ${p.meta.subtitle ? `<p class="tp__sub">${esc(p.meta.subtitle)}</p>` : ''}
        ${p.meta.description ? `<div class="rich">${D.textToHtml(p.meta.description)}</div>` : ''}
        ${p.meta.author ? `<p class="tp__by">${esc(p.meta.author)}</p>` : ''}
        <button class="btn btn--primary btn--lg" data-tp="next">${D.icon('play', 18)}Comenzar</button>
        <p class="hint">← → para moverte · Espacio: avance automático · F: pantalla completa</p></div>`;
    } else if (i >= n) {
      html = `<div class="tp__cover"><span class="eyebrow">${D.icon('flag', 14)}Fin</span>
        <h1 class="tp__h1">Fin del recorrido</h1><p class="tp__sub">${n} parada${n === 1 ? '' : 's'} · ${esc(p.meta.title)}</p>
        <div class="tp__btns"><button class="btn" data-tp="restart">${D.icon('rotate-ccw', 16)}Volver al inicio</button><button class="btn btn--primary" data-tp="exit">Salir de la presentación</button></div></div>`;
    } else {
      const it = list[i].it;
      const c = D.catById(it.categoryId) || { name: '' };
      const st = D.styleOf(it);
      html = `<div class="tp__top"><span class="chip-cat" style="--c:${esc(st.color)}"><i></i>${esc(c.name)}</span><span class="tp__count">${i + 1} / ${n}</span></div>
        <div class="tp__scroll"><h2 class="tp__title">${esc(it.title)}</h2>
        ${UI_gallery(it)}
        <div class="stag" style="--i:1">${D.ui.richHTML(it)}</div>
        <div class="stag" style="--i:2">${D.ui.linksHTML(it)}</div>
        <div class="stag" style="--i:3">${it.tags.length ? `<div class="tags">${it.tags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}</div></div>`;
    }
    panel.innerHTML = html;
    panel.classList.toggle('is-cover', i === -1 || i >= n);
    if (i >= 0 && i < n) D.ui.bindGallery(panel, list[i].it.images);
    const sc = $('.tp__scroll', panel);
    if (sc) sc.scrollTop = 0;
  }
  const UI_gallery = (it) => (it.images.length ? `<div class="stag" style="--i:0">${D.ui.galleryHTML(it.images)}</div>` : '');

  function renderBar() {
    const bar = $('#tourBar');
    const n = stepCount();
    const min = D.state.project.settings.intro ? -1 : 0;
    const label = index < 0 ? 'Portada' : index >= n ? 'Final' : `${index + 1} de ${n}`;
    bar.innerHTML = `<button class="tb__btn" data-tb="prev" title="Anterior (←)" ${index <= min ? 'disabled' : ''}>${D.icon('skip-back', 20)}</button>
      <button class="tb__btn tb__btn--play" data-tb="play" title="Avance automático (Espacio)">${D.icon(playing ? 'pause' : 'play', 22)}</button>
      <button class="tb__btn" data-tb="next" title="Siguiente (→)" ${index >= n ? 'disabled' : ''}>${D.icon('skip-forward', 20)}</button>
      <div class="tb__track">${Array.from({ length: n }, (_, k) => `<button class="tb__seg ${k < index ? 'is-done' : ''} ${k === index ? 'is-now' : ''}" data-tb="seg" data-k="${k}" title="${esc(steps()[k].it.title)}"></button>`).join('')}</div>
      <span class="tb__lab">${label}</span>
      <span class="tb__prog"><i></i></span>
      <button class="tb__btn" data-tb="fs" title="Pantalla completa (F)">${D.icon('maximize', 18)}</button>`;
    if (playing) { const b = $('.tb__prog i', bar); if (b) b.style.animation = `tbprog ${D.state.project.settings.stepDelay * 1000}ms linear forwards`; }
  }
  function bindBar() {
    $('#tourBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tb]');
      if (!b) return;
      const a = b.dataset.tb;
      if (a === 'prev') prev(); else if (a === 'next') next(); else if (a === 'play') toggle();
      else if (a === 'seg') go(+b.dataset.k); else if (a === 'fs') fullscreen();
    });
    $('#tourPanel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tp]');
      if (!b) return;
      if (b.dataset.tp === 'next') next();
      else if (b.dataset.tp === 'restart') go(D.state.project.settings.intro ? -1 : 0);
      else if (b.dataset.tp === 'exit') T.stop();
    });
    $('#tourExit').onclick = () => T.stop();
    D.on('tour-click', (id) => { const k = steps().findIndex((x) => x.it.id === id); if (k >= 0) go(k); });
  }

  T.init = () => {
    renderTab();
    bindTab();
    bindBar();
    D.on('tour', renderTab);
    D.on('project', () => { if (active) T.stop(); renderTab(); });
    D.on('items', renderTab);
    D.on('settings', (k) => { if (k && k.some((x) => ['route', 'intro', 'flyDuration', 'stepDelay', 'tourZoom'].includes(x))) renderTab(); });
    document.addEventListener('fullscreenchange', () => setTimeout(() => D.map.map.invalidateSize(), 250));
    if (view() && D.state.viewOptions.autostart) setTimeout(() => T.start(), 900);
    if (view() && D.state.viewOptions.tour === false) { $('#btnPresent2').hidden = true; }
  };
})();

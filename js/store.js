/* Derrotero · modelo de datos, estado y guardado automático (IndexedDB, con localStorage de reserva) */
(function () {
  'use strict';
  const D = window.Derrotero;

  D.DEFAULTS = { cluster: true, clusterRadius: 55, labels: false, tourZoom: 17, flyDuration: 2.4, stepDelay: 8, route: true, intro: true };
  D.SIZES = { s: 30, m: 38, l: 48, xl: 60 };
  D.BASES = ['night', 'osm', 'topo'];

  const VIEW = window.__DERROTERO_VIEW__ || null;
  D.state = {
    project: null,
    selectedId: null,
    tagFilter: new Set(),
    mode: VIEW ? 'view' : 'edit',
    tool: 'select',
    editing: null,
    savedAt: null,
    viewOptions: (VIEW && VIEW.options) || {},
  };

  D.catById = (id) => D.state.project && D.state.project.categories.find((c) => c.id === id);
  D.itemById = (id) => D.state.project && D.state.project.items.find((i) => i.id === id);

  D.newProject = (over = {}) => {
    const cid = D.uid('c');
    return Object.assign(
      {
        format: 'derrotero',
        version: 1,
        id: D.uid('p'),
        meta: { title: 'Mapa sin título', subtitle: '', description: '', author: '', created: Date.now(), updated: Date.now() },
        view: { center: [40.4168, -3.7038], zoom: 6, base: 'night' },
        settings: Object.assign({}, D.DEFAULTS),
        categories: [{ id: cid, name: 'General', color: '#C9A862', icon: 'map-pin', visible: true }],
        items: [],
        tour: { steps: [] },
      },
      over
    );
  };

  /* ---------- Normalización: se usa al cargar, importar y migrar ---------- */
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : parseFloat(v));
  const validLL = (p) => Array.isArray(p) && p.length >= 2 && isFinite(num(p[0])) && isFinite(num(p[1])) && Math.abs(num(p[0])) <= 90 && Math.abs(num(p[1])) <= 180;
  const ll = (p) => [num(p[0]), num(p[1])];
  const str = (v, max = 400) => String(v == null ? '' : v).slice(0, max);

  D.normalizeStyle = (s) => {
    if (!s || typeof s !== 'object') return null;
    const o = {};
    if (D.color.valid(s.color)) o.color = s.color;
    if (typeof s.icon === 'string' && s.icon) o.icon = s.icon;
    if (D.SIZES[s.size]) o.size = s.size;
    if (s.shape === 'pin' || s.shape === 'circle') o.shape = s.shape;
    if (isFinite(num(s.weight))) o.weight = D.clamp(num(s.weight), 1, 14);
    if (isFinite(num(s.fill))) o.fill = D.clamp(num(s.fill), 0, 1);
    if (s.dash) o.dash = true;
    return Object.keys(o).length ? o : null;
  };

  D.normalizeItem = (raw, catIds, fallbackCat) => {
    if (!raw || typeof raw !== 'object') return null;
    const type = ['point', 'line', 'area'].includes(raw.type) ? raw.type : null;
    if (!type) return null;
    let coords;
    if (type === 'point') {
      if (!validLL(raw.coords)) return null;
      coords = ll(raw.coords);
    } else {
      if (!Array.isArray(raw.coords) || !raw.coords.every(validLL)) return null;
      coords = raw.coords.map(ll);
      if (coords.length < (type === 'line' ? 2 : 3)) return null;
    }
    const tags = Array.from(new Set((Array.isArray(raw.tags) ? raw.tags : []).map((t) => str(t, 40).trim()).filter(Boolean)));
    const links = (Array.isArray(raw.links) ? raw.links : [])
      .map((l) => ({ label: str(l && l.label, 80).trim(), url: D.safeUrl(l && l.url) }))
      .filter((l) => l.url);
    const images = (Array.isArray(raw.images) ? raw.images : [])
      .map((i) => (typeof i === 'string' ? { src: D.safeImg(i), caption: '' } : { src: D.safeImg(i && i.src), caption: str(i && i.caption, 200) }))
      .filter((i) => i.src);
    return {
      id: str(raw.id, 60) || D.uid('i'),
      type,
      categoryId: catIds.has(raw.categoryId) ? raw.categoryId : fallbackCat,
      title: str(raw.title, 160) || 'Sin título',
      description: D.sanitize(raw.description || ''),
      tags, links, images,
      style: D.normalizeStyle(raw.style),
      coords,
      createdAt: raw.createdAt || Date.now(),
    };
  };

  D.normalizeProject = (raw) => {
    const base = D.newProject();
    if (!raw || typeof raw !== 'object') return base;
    const out = {
      format: 'derrotero', version: 1,
      id: str(raw.id, 60) || D.uid('p'),
      meta: Object.assign({}, base.meta, {
        title: str(raw.meta && raw.meta.title, 160) || 'Mapa sin título',
        subtitle: str(raw.meta && raw.meta.subtitle, 240),
        description: str(raw.meta && raw.meta.description, 2000),
        author: str(raw.meta && raw.meta.author, 120),
        created: (raw.meta && raw.meta.created) || Date.now(),
        updated: (raw.meta && raw.meta.updated) || Date.now(),
      }),
      view: {
        center: raw.view && validLL(raw.view.center) ? ll(raw.view.center) : base.view.center,
        zoom: raw.view && isFinite(num(raw.view.zoom)) ? D.clamp(num(raw.view.zoom), 1, 19) : base.view.zoom,
        base: raw.view && D.BASES.includes(raw.view.base) ? raw.view.base : 'night',
      },
      settings: Object.assign({}, D.DEFAULTS),
      categories: [], items: [], tour: { steps: [] },
    };
    const rs = raw.settings || {};
    Object.keys(D.DEFAULTS).forEach((k) => { if (typeof rs[k] === typeof D.DEFAULTS[k]) out.settings[k] = rs[k]; });
    const seen = new Set();
    (Array.isArray(raw.categories) ? raw.categories : []).forEach((c) => {
      if (!c || typeof c !== 'object') return;
      let id = str(c.id, 60) || D.uid('c');
      if (seen.has(id)) id = D.uid('c');
      seen.add(id);
      out.categories.push({ id, name: str(c.name, 80) || 'Categoría', color: D.color.valid(c.color) ? c.color : '#C9A862', icon: typeof c.icon === 'string' && c.icon ? c.icon : 'map-pin', visible: c.visible !== false });
    });
    if (!out.categories.length) out.categories.push(base.categories[0]);
    const catIds = new Set(out.categories.map((c) => c.id));
    const ids = new Set();
    (Array.isArray(raw.items) ? raw.items : []).forEach((r) => {
      const it = D.normalizeItem(r, catIds, out.categories[0].id);
      if (!it) return;
      if (ids.has(it.id)) it.id = D.uid('i');
      ids.add(it.id);
      out.items.push(it);
    });
    out.tour.steps = ((raw.tour && raw.tour.steps) || [])
      .filter((s) => s && ids.has(s.itemId))
      .map((s) => ({ itemId: s.itemId, zoom: isFinite(num(s.zoom)) ? D.clamp(num(s.zoom), 3, 19) : null }));
    return out;
  };

  /* ---------- Persistencia ---------- */
  const IDB = {
    kind: 'indexedDB', db: null,
    open() {
      return new Promise((res, rej) => {
        if (!window.indexedDB) return rej(new Error('sin indexedDB'));
        const rq = indexedDB.open('derrotero', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('projects', { keyPath: 'id' });
        rq.onsuccess = () => { IDB.db = rq.result; res(); };
        rq.onerror = () => rej(rq.error);
        rq.onblocked = () => rej(new Error('bloqueada'));
      });
    },
    tx(mode, fn) {
      return new Promise((res, rej) => {
        const t = IDB.db.transaction('projects', mode);
        const rq = fn(t.objectStore('projects'));
        t.oncomplete = () => res(rq && rq.result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    },
    put: (p) => IDB.tx('readwrite', (s) => s.put(p)),
    get: (id) => IDB.tx('readonly', (s) => s.get(id)),
    all: () => IDB.tx('readonly', (s) => s.getAll()),
    del: (id) => IDB.tx('readwrite', (s) => s.delete(id)),
  };
  const LS = {
    kind: 'localStorage',
    async open() { localStorage.getItem('x'); },
    async put(p) { localStorage.setItem('derrotero:p:' + p.id, JSON.stringify(p)); },
    async get(id) { const v = localStorage.getItem('derrotero:p:' + id); return v ? JSON.parse(v) : undefined; },
    async all() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('derrotero:p:')) { try { out.push(JSON.parse(localStorage.getItem(k))); } catch (e) { /* ignora */ } }
      }
      return out;
    },
    async del(id) { localStorage.removeItem('derrotero:p:' + id); },
  };
  const MEM = { kind: 'memoria', _m: {}, async open() {}, async put(p) { MEM._m[p.id] = JSON.parse(JSON.stringify(p)); }, async get(id) { return MEM._m[id]; }, async all() { return Object.values(MEM._m); }, async del(id) { delete MEM._m[id]; } };
  let adapter = MEM;

  const lastKey = 'derrotero:last';
  const getLast = () => { try { return localStorage.getItem(lastKey); } catch (e) { return null; } };
  const setLast = (id) => { try { localStorage.setItem(lastKey, id); } catch (e) { /* ignora */ } };

  let dirty = false;
  const doSave = async () => {
    if (D.state.mode === 'view' || !D.state.project) return;
    try {
      await adapter.put(JSON.parse(JSON.stringify(D.state.project)));
      dirty = false;
      D.state.savedAt = Date.now();
      D.emit('save-status', { ok: true, at: D.state.savedAt, kind: adapter.kind });
    } catch (e) {
      console.error('[Derrotero] no se pudo guardar', e);
      D.emit('save-status', { ok: false, error: e });
    }
  };
  const saveSoon = D.debounce(doSave, 500);
  window.addEventListener('beforeunload', () => { if (dirty) doSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) doSave(); });

  const touch = (scope, detail) => {
    const p = D.state.project;
    p.meta.updated = Date.now();
    dirty = true;
    D.emit('save-status', { ok: true, pending: true });
    saveSoon();
    D.emit(scope, detail || {});
    D.emit('change', { scope, detail });
  };

  /* ---------- API ---------- */
  D.store = {
    get adapterKind() { return adapter.kind; },

    async init() {
      if (D.state.mode === 'view') {
        D.state.project = D.normalizeProject(VIEW.project);
        return;
      }
      for (const a of [IDB, LS]) {
        try { await a.open(); adapter = a; break; } catch (e) { console.warn('[Derrotero] almacenamiento no disponible:', a.kind, e); }
      }
      if (adapter === MEM) setTimeout(() => D.toast('Este navegador no permite guardar datos: exporta tu mapa para no perderlo', { kind: 'warn', ms: 8000 }), 1200);
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignora */ }
      let p = null;
      const last = getLast();
      if (last) { try { p = await adapter.get(last); } catch (e) { /* ignora */ } }
      if (!p) {
        const all = (await adapter.all().catch(() => [])) || [];
        all.sort((a, b) => ((b.meta && b.meta.updated) || 0) - ((a.meta && a.meta.updated) || 0));
        p = all[0] || null;
      }
      if (!p) {
        D.state.project = D.normalizeProject(D.buildDemo ? D.buildDemo() : D.newProject());
        await doSave();
      } else D.state.project = D.normalizeProject(p);
      setLast(D.state.project.id);
    },

    async list() {
      const all = (await adapter.all().catch(() => [])) || [];
      return all
        .map((p) => ({ id: p.id, title: (p.meta && p.meta.title) || 'Mapa sin título', updated: (p.meta && p.meta.updated) || 0, count: (p.items || []).length }))
        .sort((a, b) => b.updated - a.updated);
    },

    async flush() { saveSoon.cancel(); if (dirty) await doSave(); },

    replace(raw, { persist = true } = {}) {
      D.state.project = D.normalizeProject(raw);
      D.state.selectedId = null;
      D.state.tagFilter.clear();
      setLast(D.state.project.id);
      D.emit('project', D.state.project);
      if (persist) { dirty = true; doSave(); }
    },

    async open(id) {
      await D.store.flush();
      const p = await adapter.get(id);
      if (!p) return D.toast('No se encuentra ese mapa', { kind: 'warn' });
      D.store.replace(p, { persist: false });
      D.emit('save-status', { ok: true, at: D.state.project.meta.updated });
    },
    async create(raw) {
      await D.store.flush();
      D.store.replace(raw || D.newProject());
    },
    async duplicate() {
      await D.store.flush();
      const c = JSON.parse(JSON.stringify(D.state.project));
      c.id = D.uid('p');
      c.meta.title += ' (copia)';
      c.meta.created = c.meta.updated = Date.now();
      D.store.replace(c);
      D.toast('Mapa duplicado');
    },
    async remove(id) {
      await adapter.del(id);
      if (D.state.project.id === id) {
        const rest = await D.store.list();
        if (rest.length) await D.store.open(rest[0].id);
        else D.store.replace(D.newProject());
      }
    },

    /* --- elementos --- */
    addItem(item) {
      D.state.project.items.push(item);
      touch('items', { op: 'add', id: item.id });
      return item;
    },
    updateItem(id, patch) {
      const it = D.itemById(id);
      if (!it) return;
      Object.assign(it, patch);
      touch('items', { op: 'update', id });
    },
    removeItem(id, { undo = true } = {}) {
      const items = D.state.project.items;
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const [it] = items.splice(idx, 1);
      const steps = D.state.project.tour.steps;
      const stepIdx = steps.findIndex((s) => s.itemId === id);
      const step = stepIdx >= 0 ? steps.splice(stepIdx, 1)[0] : null;
      if (D.state.selectedId === id) D.state.selectedId = null;
      touch('items', { op: 'remove', id });
      if (step) D.emit('tour', {});
      if (undo)
        D.toast('«' + it.title + '» eliminado', {
          action: { label: 'Deshacer', fn: () => { items.splice(Math.min(idx, items.length), 0, it); if (step) steps.splice(Math.min(stepIdx, steps.length), 0, step); touch('items', { op: 'add', id: it.id }); if (step) D.emit('tour', {}); } },
        });
    },
    bulkItems(list) {
      list.forEach((it) => D.state.project.items.push(it));
      touch('items', { op: 'bulk' });
    },

    /* --- categorías --- */
    addCategory(c) {
      const cat = Object.assign({ id: D.uid('c'), name: 'Nueva categoría', color: D.PALETTE[D.state.project.categories.length % D.PALETTE.length], icon: 'map-pin', visible: true }, c);
      D.state.project.categories.push(cat);
      touch('categories', { op: 'add', id: cat.id });
      return cat;
    },
    updateCategory(id, patch) {
      const c = D.catById(id);
      if (!c) return;
      Object.assign(c, patch);
      touch('categories', { op: 'update', id });
    },
    setVisible(id, v) {
      const c = D.catById(id);
      if (!c) return;
      c.visible = v;
      touch('categories', { op: 'visible', id });
    },
    isolate(id) {
      D.state.project.categories.forEach((c) => (c.visible = c.id === id));
      touch('categories', { op: 'visible' });
    },
    setAllVisible(v) {
      D.state.project.categories.forEach((c) => (c.visible = v));
      touch('categories', { op: 'visible' });
    },
    removeCategory(id, moveTo) {
      const p = D.state.project;
      if (p.categories.length < 2) return D.toast('Tiene que quedar al menos una categoría', { kind: 'warn' });
      const idx = p.categories.findIndex((c) => c.id === id);
      if (idx < 0) return;
      const backup = { cat: p.categories[idx], idx, moved: [] };
      const target = moveTo || p.categories.find((c) => c.id !== id).id;
      p.items.forEach((i) => { if (i.categoryId === id) { backup.moved.push(i.id); i.categoryId = target; } });
      p.categories.splice(idx, 1);
      touch('categories', { op: 'remove', id });
      D.emit('items', { op: 'bulk' });
      D.toast('Categoría «' + backup.cat.name + '» eliminada', {
        action: { label: 'Deshacer', fn: () => { p.categories.splice(backup.idx, 0, backup.cat); backup.moved.forEach((iid) => { const it = D.itemById(iid); if (it) it.categoryId = id; }); touch('categories', { op: 'add', id }); D.emit('items', { op: 'bulk' }); } },
      });
    },

    /* --- recorrido, metadatos, ajustes, vista --- */
    setSteps(steps) { D.state.project.tour.steps = steps; touch('tour'); },
    setMeta(patch) { Object.assign(D.state.project.meta, patch); touch('meta'); },
    setSettings(patch) { Object.assign(D.state.project.settings, patch); touch('settings', Object.keys(patch)); },
    setBase(b) { D.state.project.view.base = b; touch('settings', ['base']); },
    setView(center, zoom) {
      const v = D.state.project.view;
      v.center = [+center.lat.toFixed(6), +center.lng.toFixed(6)];
      v.zoom = zoom;
      dirty = true; saveSoon();
    },
    clearAll() {
      const p = D.state.project;
      p.items = []; p.tour.steps = [];
      D.state.selectedId = null;
      touch('items', { op: 'bulk' });
      D.emit('tour', {});
    },
    exportObject() {
      return JSON.parse(JSON.stringify(D.state.project));
    },
  };

  /* Etiquetas disponibles y su frecuencia */
  D.allTags = () => {
    const m = new Map();
    D.state.project.items.forEach((i) => i.tags.forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  };

  /* Estilo efectivo de un elemento (herencia: elemento → categoría → valores por defecto) */
  D.styleOf = (item) => {
    const c = D.catById(item.categoryId) || {};
    const s = item.style || {};
    return {
      color: s.color || c.color || '#C9A862',
      icon: s.icon || c.icon || 'map-pin',
      size: s.size || 'm',
      shape: s.shape || 'pin',
      weight: s.weight || (item.type === 'line' ? 4 : 3),
      fill: s.fill != null ? s.fill : 0.22,
      dash: !!s.dash,
    };
  };
})();

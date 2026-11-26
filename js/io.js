/* Derrotero · importar y exportar: JSON propio, GeoJSON y HTML incrustable */
(function () {
  'use strict';
  const D = window.Derrotero;
  const $ = D.$;
  const esc = D.esc;
  const IO = (D.io = {});

  /* ======================== Exportar ======================== */
  IO.exportJSON = () => {
    const p = D.store.exportObject();
    D.download(D.slug(p.meta.title) + '.derrotero.json', JSON.stringify(p, null, 2));
    D.toast('Copia completa descargada');
  };

  IO.toGeoJSON = (p) => {
    const cats = new Map(p.categories.map((c) => [c.id, c]));
    return {
      type: 'FeatureCollection',
      name: p.meta.title,
      features: p.items.map((it) => {
        const c = cats.get(it.categoryId) || {};
        const s = it.style || {};
        const color = s.color || c.color || '#C9A862';
        const props = {
          id: it.id, title: it.title, name: it.title, description: it.description, category: c.name || '', categoryId: it.categoryId,
          tags: it.tags, links: it.links, images: it.images, kind: it.type,
          icon: s.icon || c.icon || 'map-pin', color, size: s.size || 'm', shape: s.shape || 'pin',
          'marker-color': color, stroke: color, 'stroke-width': s.weight || (it.type === 'line' ? 4 : 3), fill: color, 'fill-opacity': s.fill != null ? s.fill : 0.22,
        };
        let geometry;
        if (it.type === 'point') geometry = { type: 'Point', coordinates: [it.coords[1], it.coords[0]] };
        else if (it.type === 'line') geometry = { type: 'LineString', coordinates: it.coords.map((c2) => [c2[1], c2[0]]) };
        else { const ring = it.coords.map((c2) => [c2[1], c2[0]]); ring.push(ring[0]); geometry = { type: 'Polygon', coordinates: [ring] }; }
        return { type: 'Feature', properties: props, geometry };
      }),
      derrotero: { version: 1, meta: p.meta, view: p.view, settings: p.settings, categories: p.categories, tour: p.tour },
    };
  };
  IO.exportGeoJSON = () => {
    const p = D.store.exportObject();
    D.download(D.slug(p.meta.title) + '.geojson', JSON.stringify(IO.toGeoJSON(p), null, 2), 'application/geo+json');
    D.toast('GeoJSON descargado');
  };

  /* ======================== Importar ======================== */
  const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== '') return o[k]; return undefined; };
  const KNOWN = new Set(['id', 'title', 'name', 'description', 'category', 'categoryId', 'tags', 'links', 'images', 'kind', 'icon', 'color', 'size', 'shape', 'marker-color', 'marker-size', 'marker-symbol', 'stroke', 'stroke-width', 'stroke-opacity', 'fill', 'fill-opacity']);

  function flatten(g, out) {
    if (!g || !g.type) return;
    const C = g.coordinates;
    const ok = (a) => Array.isArray(a) && a.length >= 2 && isFinite(a[0]) && isFinite(a[1]);
    const toLL = (a) => [+a[1], +a[0]];
    if (g.type === 'Point' && ok(C)) out.push({ type: 'point', coords: toLL(C) });
    else if (g.type === 'MultiPoint') C.filter(ok).forEach((c) => out.push({ type: 'point', coords: toLL(c) }));
    else if (g.type === 'LineString') { const pts = C.filter(ok).map(toLL); if (pts.length > 1) out.push({ type: 'line', coords: pts }); }
    else if (g.type === 'MultiLineString') C.forEach((l) => { const pts = l.filter(ok).map(toLL); if (pts.length > 1) out.push({ type: 'line', coords: pts }); });
    else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const polys = g.type === 'Polygon' ? [C] : C;
      polys.forEach((poly) => {
        let ring = (poly[0] || []).filter(ok).map(toLL);
        if (ring.length > 3 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
        if (ring.length > 2) out.push({ type: 'area', coords: ring });
      });
    } else if (g.type === 'GeometryCollection') (g.geometries || []).forEach((x) => flatten(x, out));
  }

  IO.geojsonToProject = (obj, name) => {
    const feats = obj.type === 'FeatureCollection' ? obj.features || [] : obj.type === 'Feature' ? [obj] : [{ type: 'Feature', geometry: obj, properties: {} }];
    const f = obj.derrotero || {};
    const cats = [];
    const byName = new Map();
    (Array.isArray(f.categories) ? f.categories : []).forEach((c) => { if (c && c.name) { cats.push(c); byName.set(D.norm(c.name), c); } });
    const getCat = (n, color, icon) => {
      const key = D.norm(n || 'Importados');
      if (byName.has(key)) return byName.get(key);
      const c = { id: D.uid('c'), name: n || 'Importados', color: color && D.color.valid(color) ? color : D.PALETTE[cats.length % D.PALETTE.length], icon: icon || 'map-pin', visible: true };
      cats.push(c); byName.set(key, c);
      return c;
    };
    const items = [];
    const idMap = new Map();
    feats.slice(0, 20000).forEach((ft, n) => {
      const pr = (ft && ft.properties) || {};
      const geoms = [];
      flatten(ft && ft.geometry, geoms);
      geoms.forEach((g, k) => {
        const color = pick(pr, ['color', 'marker-color', 'stroke', 'fill']);
        const cat = getCat(String(pick(pr, ['category', 'categoria', 'categoría', 'group', 'type', 'tipo']) || 'Importados'), color);
        let desc = pick(pr, ['description', 'descripcion', 'descripción', 'desc', 'Description', 'comment', 'note']);
        if (desc != null) desc = /<[a-z][\s\S]*>/i.test(String(desc)) ? D.sanitize(String(desc)) : D.textToHtml(String(desc));
        else {
          const rows = Object.keys(pr).filter((key) => !KNOWN.has(key) && pr[key] != null && typeof pr[key] !== 'object' && String(pr[key]).trim() !== '').slice(0, 14);
          desc = rows.length ? '<ul>' + rows.map((key) => `<li><b>${esc(key)}:</b> ${esc(String(pr[key]).slice(0, 240))}</li>`).join('') + '</ul>' : '';
        }
        const tags = Array.isArray(pr.tags) ? pr.tags : typeof pr.tags === 'string' ? pr.tags.split(/[,;]/) : [];
        const linksRaw = Array.isArray(pr.links) ? pr.links : [];
        const single = pick(pr, ['url', 'website', 'web', 'link', 'href']);
        if (single && typeof single === 'string') linksRaw.push({ label: '', url: single });
        const imgsRaw = Array.isArray(pr.images) ? pr.images : [];
        const one = pick(pr, ['image', 'img', 'foto', 'photo', 'picture']);
        if (one && typeof one === 'string') imgsRaw.push({ src: one, caption: '' });
        const sz = pick(pr, ['size', 'marker-size']);
        const style = {};
        if (color && D.color.valid(color)) style.color = color;
        if (pr.icon && window.DerroteroIcons.pick[pr.icon]) style.icon = pr.icon;
        if (D.SIZES[sz]) style.size = sz;
        if (pr.shape) style.shape = pr.shape;
        if (g.type !== 'point') {
          if (isFinite(+pr['stroke-width'])) style.weight = +pr['stroke-width'];
          if (isFinite(+pr['fill-opacity'])) style.fill = +pr['fill-opacity'];
        }
        // si el color coincide con el de la categoría no hace falta duplicarlo
        if (style.color && cat.color === style.color) delete style.color;
        let id = pick(pr, ['id']);
        id = id ? String(id) : D.uid('i');
        if (idMap.has(id)) id = D.uid('i');
        idMap.set(id, true);
        items.push({
          id, type: g.type, categoryId: cat.id, coords: g.coords,
          title: String(pick(pr, ['title', 'name', 'Name', 'NAME', 'nombre', 'Nombre', 'label']) || (geoms.length > 1 ? `Elemento ${n + 1}.${k + 1}` : `Elemento ${n + 1}`)),
          description: desc, tags, links: linksRaw, images: imgsRaw, style,
        });
      });
    });
    if (!cats.length) cats.push({ id: D.uid('c'), name: 'Importados', color: '#C9A862', icon: 'map-pin', visible: true });
    return {
      meta: Object.assign({}, f.meta || {}, { title: (f.meta && f.meta.title) || obj.name || name || 'Mapa importado' }),
      view: f.view && f.view.center ? f.view : undefined, settings: f.settings, categories: cats, items, tour: f.tour || { steps: [] },
    };
  };

  const kindOf = (o) => {
    if (!o || typeof o !== 'object') return null;
    if (o.format === 'derrotero' || (Array.isArray(o.items) && Array.isArray(o.categories))) return 'project';
    if (['FeatureCollection', 'Feature', 'GeometryCollection', 'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(o.type)) return 'geojson';
    return null;
  };

  IO.importFile = async (file) => {
    if (D.state.mode === 'view') return;
    if (D.state.editing) return D.toast('Termina de editar antes de importar', { kind: 'warn' });
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { return D.toast('El archivo no es un JSON válido', { kind: 'warn' }); }
    const kind = kindOf(obj);
    if (!kind) return D.toast('No reconozco el formato: usa un GeoJSON o un JSON exportado de Derrotero', { kind: 'warn' });
    const base = file.name.replace(/\.(geo)?json$/i, '').replace(/\.derrotero$/i, '');
    const raw = kind === 'project' ? obj : IO.geojsonToProject(obj, base);
    const norm = D.normalizeProject(raw);
    if (!norm.items.length) return D.toast('El archivo no contiene ningún elemento que se pueda dibujar', { kind: 'warn' });
    const n = { point: 0, line: 0, area: 0 };
    norm.items.forEach((i) => n[i.type]++);
    const body = D.el(`<div class="form"><p>El archivo <b>${esc(file.name)}</b> contiene <b>${norm.items.length}</b> elemento${norm.items.length === 1 ? '' : 's'} (${n.point} punto${n.point === 1 ? '' : 's'}, ${n.line} línea${n.line === 1 ? '' : 's'}, ${n.area} área${n.area === 1 ? '' : 's'}) en <b>${norm.categories.length}</b> categoría${norm.categories.length === 1 ? '' : 's'}.</p>
      <div class="choice"><label class="choice__it"><input type="radio" name="imp" value="new" checked><span><b>Abrir como mapa nuevo</b><small>Tu mapa actual se conserva en «Mis mapas».</small></span></label>
      <label class="choice__it"><input type="radio" name="imp" value="merge"><span><b>Añadir al mapa actual</b><small>Las categorías con el mismo nombre se unen.</small></span></label></div></div>`);
    D.modal({
      title: 'Importar datos', body, size: 'sm',
      actions: [{ label: 'Cancelar' }, {
        label: 'Importar', kind: 'primary', onClick: async () => {
          const mode = $('input[name=imp]:checked', body).value;
          if (mode === 'new') { await D.store.create(Object.assign(norm, { id: D.uid('p') })); D.toast('Mapa importado'); }
          else { merge(norm); D.toast('Datos añadidos al mapa'); }
        },
      }],
    });
  };

  function merge(inc) {
    const p = D.state.project;
    const remap = new Map();
    inc.categories.forEach((c) => {
      const same = p.categories.find((x) => x.id === c.id) || p.categories.find((x) => D.norm(x.name) === D.norm(c.name));
      if (same) remap.set(c.id, same.id);
      else remap.set(c.id, D.store.addCategory({ name: c.name, color: c.color, icon: c.icon, visible: true }).id);
    });
    const ids = new Set(p.items.map((i) => i.id));
    const idMap = new Map();
    const items = inc.items.map((it) => {
      const n = Object.assign({}, it, { categoryId: remap.get(it.categoryId) });
      idMap.set(it.id, it.id);
      if (ids.has(n.id)) { n.id = D.uid('i'); idMap.set(it.id, n.id); }
      ids.add(n.id);
      return n;
    });
    D.store.bulkItems(items);
    if (inc.tour && inc.tour.steps.length) D.store.setSteps(p.tour.steps.concat(inc.tour.steps.map((s) => ({ itemId: idMap.get(s.itemId), zoom: s.zoom })).filter((s) => s.itemId)));
    D.map.fitAll();
  }

  /* ======================== HTML incrustable ======================== */
  const embedOpts = { panel: true, search: true, tour: true, autostart: false, height: '560' };
  const buildEmbed = IO.buildEmbed = function (opts) {
    const tpl = window.DerroteroViewerTemplate;
    if (!tpl) return null;
    const p = D.store.exportObject();
    const json = JSON.stringify({ project: p, options: { panel: !!opts.panel, search: !!opts.search, tour: !!opts.tour, autostart: !!opts.autostart } })
      .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return tpl.replace('/*__DERROTERO_DATA__*/null', () => json).replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(p.meta.title) + '</title>');
  };
  IO.embedDialog = () => {
    const p = D.state.project;
    if (!window.DerroteroViewerTemplate) return D.toast('Falta js/viewer-template.js: ejecuta «node tools/build-viewer-template.js» (mira el README)', { kind: 'warn', ms: 8000 });
    const fname = D.slug(p.meta.title) + '.html';
    const body = D.el(`<div class="form">
      <p class="muted">Genera un único archivo HTML con tu mapa, sus imágenes y el visor (Leaflet incluido). Sin servidor ni base de datos: súbelo a tu web y muéstralo dentro de un <code>iframe</code>, o ábrelo directamente.</p>
      <div class="row"><div><b>Panel lateral</b><small>Capas, etiquetas y lista de paradas</small></div><div data-o="panel"></div></div>
      <div class="row"><div><b>Buscador</b><small>Busca entre los elementos del mapa</small></div><div data-o="search"></div></div>
      <div class="row"><div><b>Botón de recorrido</b><small>Permite lanzar la presentación</small></div><div data-o="tour"></div></div>
      <div class="row"><div><b>Iniciar el recorrido al cargar</b><small>Útil para una presentación a pantalla completa</small></div><div data-o="autostart"></div></div>
      <label class="field"><span>Alto del iframe</span><input type="text" id="embH" value="${esc(embedOpts.height)}" placeholder="560 o 70vh"></label>
      <div class="field"><span>Código para incrustarlo <small id="embSize"></small></span><textarea id="embCode" rows="4" readonly></textarea></div></div>`);
    ['panel', 'search', 'tour', 'autostart'].forEach((k) => $(`[data-o=${k}]`, body).appendChild(D.ui.switchEl(embedOpts[k], (v) => { embedOpts[k] = v; })));
    const code = () => {
      let h = $('#embH', body).value.trim() || '560';
      embedOpts.height = h;
      if (/^\d+$/.test(h)) h += 'px';
      $('#embCode', body).value = `<iframe src="${fname}" title="${esc(p.meta.title)}" style="width:100%;height:${h};border:0;border-radius:12px" loading="lazy" allow="fullscreen" allowfullscreen></iframe>`;
    };
    code();
    $('#embH', body).addEventListener('input', code);
    const html = () => buildEmbed(embedOpts);
    const size = () => { const h = html(); if (h) $('#embSize', body).textContent = '· archivo de ' + (h.length / 1048576 >= 1 ? (h.length / 1048576).toFixed(1) + ' MB' : Math.round(h.length / 1024) + ' KB'); };
    size();
    body.addEventListener('change', () => setTimeout(size, 0));
    D.modal({
      title: 'HTML incrustable', body, size: 'md',
      actions: [
        { label: 'Copiar código del iframe', keep: true, onClick: async () => { code(); if (await D.copy($('#embCode', body).value)) D.toast('Código copiado'); return false; } },
        { label: 'Previsualizar', keep: true, onClick: () => { const h = html(); if (h) window.open(URL.createObjectURL(new Blob([h], { type: 'text/html' })), '_blank'); return false; } },
        { label: 'Descargar ' + fname, kind: 'primary', onClick: () => { const h = html(); if (!h) return false; D.download(fname, h, 'text/html'); D.toast('HTML descargado'); } },
      ],
    });
  };

  /* ======================== Arrastrar y soltar ======================== */
  IO.init = () => {
    if (D.state.mode === 'view') return;
    const fi = $('#fileImport');
    fi.addEventListener('change', () => { if (fi.files[0]) IO.importFile(fi.files[0]); fi.value = ''; });
    const ov = $('#dropOverlay');
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e) || e.target.closest('.drop')) return; depth++; ov.classList.add('is-open'); });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) ov.classList.remove('is-open'); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      depth = 0; ov.classList.remove('is-open');
      if (e.target.closest('.drop')) return;
      e.preventDefault();
      const f = Array.from(e.dataTransfer.files).find((x) => /\.(geo)?json$/i.test(x.name) || x.type.includes('json'));
      if (f) IO.importFile(f);
      else D.toast('Suelta un archivo .geojson o .json', { kind: 'warn' });
    });
  };
})();

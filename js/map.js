/* Derrotero · mapa Leaflet: capas base, marcas, formas, agrupación, selección y vuelos */
(function () {
  'use strict';
  const D = window.Derrotero;
  const L = window.L;

  const ATTR_ESRI = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';
  const ESRI = (svc) => 'https://server.arcgisonline.com/ArcGIS/rest/services/' + svc + '/MapServer/tile/{z}/{y}/{x}';
  const BASES = {
    night: { name: 'Noche', url: ESRI('Canvas/World_Dark_Gray_Base'), ref: ESRI('Canvas/World_Dark_Gray_Reference'), maxNative: 16, maxZoom: 19, attr: ATTR_ESRI },
    osm: { name: 'Estándar', url: ESRI('World_Street_Map'), maxNative: 19, maxZoom: 19, attr: ATTR_ESRI },
    topo: { name: 'Relieve', url: ESRI('World_Topo_Map'), maxNative: 18, maxZoom: 19, attr: ATTR_ESRI },
  };
  const PIN = 'M18 45C18 45 3 28.5 3 17.5C3 9.2 9.7 2.5 18 2.5S33 9.2 33 17.5C33 28.5 18 45 18 45Z';
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const M = (D.map = {});
  const reg = new Map(); // id -> { item, kind, layer, parts }
  let map, tiles, pointGroup, shapeGroup, tempLayer, previewGroup, forcedId = null;

  /* ---------- Iconos de marca ---------- */
  function glyph(name) {
    const I = window.DerroteroIcons;
    return (I.pick[name] && I.pick[name].s) || I.ui[name] || I.pick['map-pin'].s;
  }
  M.markerHTML = (st, selected) => {
    const px = D.SIZES[st.size] || 38;
    const fg = D.color.readable(st.color);
    const gl = `<svg class="mk__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph(st.icon)}</svg>`;
    if (st.shape === 'circle')
      return `<div class="mk mk--circle${selected ? ' is-selected' : ''}" style="--c:${st.color};--fg:${fg};--s:${px}px"><span class="mk__ring"></span><span class="mk__body">${gl}</span></div>`;
    return `<div class="mk mk--pin${selected ? ' is-selected' : ''}" style="--c:${st.color};--fg:${fg};--s:${px}px"><span class="mk__ring"></span><svg class="mk__pin" viewBox="0 0 36 46"><path d="${PIN}"/></svg>${gl}</div>`;
  };
  function buildIcon(item, selected) {
    const st = D.styleOf(item);
    const px = D.SIZES[st.size] || 38;
    const h = st.shape === 'circle' ? px : Math.round(px * 1.278);
    return L.divIcon({
      className: 'mk-wrap', html: M.markerHTML(st, selected), iconSize: [px, h],
      iconAnchor: st.shape === 'circle' ? [px / 2, px / 2] : [px / 2, h - 1], tooltipAnchor: [0, st.shape === 'circle' ? -px / 2 : -h + 4],
    });
  }

  /* ---------- Inicio ---------- */
  M.init = (el) => {
    map = M.map = L.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 110, worldCopyJump: true, minZoom: 2, preferCanvas: false });
    map.attributionControl.setPrefix('');
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
    shapeGroup = L.layerGroup().addTo(map);
    tempLayer = L.layerGroup().addTo(map);
    previewGroup = L.layerGroup().addTo(map);
    new ResizeObserver(() => map.invalidateSize({ animate: false })).observe(el);
    map.on('moveend', D.debounce(() => { if (D.state.mode === 'edit' && D.state.project) D.store.setView(map.getCenter(), map.getZoom()); }, 600));
    map.on('click', () => {
      if (D.state.tool === 'select' && D.state.selectedId) M.select(null);
      D.emit('map-click');
    });
    map.on('contextmenu', (e) => D.emit('map-context', e));
    M.makeGroup();
    D.on('project', M.loadProject);
    D.on('items', (d) => {
      if (!d || d.op === 'bulk') return M.renderAll();
      if (d.op === 'remove') return removeLayer(d.id);
      applyItem(D.itemById(d.id));
      applyVisibility();
    });
    D.on('categories', (d) => { if (d && d.op === 'visible') applyVisibility(); else M.renderAll(); });
    D.on('filters', applyVisibility);
    D.on('settings', (keys) => {
      keys = keys || [];
      if (keys.includes('base')) M.setBase(D.state.project.view.base);
      if (keys.some((k) => ['cluster', 'clusterRadius', 'labels'].includes(k))) { M.makeGroup(); M.renderAll(); }
    });
    M.loadProject();
  };

  M.loadProject = () => {
    const p = D.state.project;
    M.makeGroup();
    M.setBase(p.view.base);
    map.setView(p.view.center, p.view.zoom, { animate: false });
    M.renderAll();
    const def = p.view.zoom === 6 && p.view.center[0] === 40.4168;
    if (def && p.items.length) M.fitAll({ animate: false });
  };

  M.setBase = (name) => {
    const b = BASES[name] || BASES.night;
    if (tiles) map.removeLayer(tiles);
    if (M._ref) { map.removeLayer(M._ref); M._ref = null; }
    tiles = L.tileLayer(b.url, { maxZoom: b.maxZoom, maxNativeZoom: b.maxNative || b.maxZoom, attribution: b.attr, crossOrigin: true, keepBuffer: 4 }).addTo(map);
    if (b.ref) { M._ref = L.tileLayer(b.ref, { maxZoom: b.maxZoom, maxNativeZoom: b.maxNative || b.maxZoom, crossOrigin: true, keepBuffer: 4 }).addTo(map); M._ref.setZIndex(2); }
    tiles.setZIndex(1);
    let ok = 0, bad = 0, warned = false;
    tiles.on('tileload', () => { ok++; });
    tiles.on('tileerror', () => {
      bad++;
      if (!warned && !ok && bad >= 4) {
        warned = true;
        D.toast(navigator.onLine === false ? 'Sin conexión: el mapa base necesita internet. Tus puntos siguen aquí.' : 'No se pueden cargar los mosaicos del mapa base. Prueba con otro (Estándar o Relieve) o revisa la conexión.', { kind: 'warn', ms: 9000 });
      }
    });
    const pane = map.getPane('tilePane');
    pane.classList.remove('tiles-night');
    map.getContainer().classList.toggle('is-night', name === 'night');
    if (map.getZoom() > b.maxZoom) map.setZoom(b.maxZoom);
    map.setMaxZoom(19);
    D.emit('base-changed', name);
  };

  /* ---------- Grupos de marcas (con o sin agrupación) ---------- */
  M.makeGroup = () => {
    const s = D.state.project.settings;
    if (pointGroup) { map.removeLayer(pointGroup); pointGroup.clearLayers(); }
    reg.forEach((e) => { e.shown = false; });
    if (s.cluster && L.markerClusterGroup) {
      pointGroup = L.markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: s.clusterRadius, disableClusteringAtZoom: 17,
        spiderfyOnMaxZoom: true, zoomToBoundsOnClick: true, animate: !reduceMotion(), chunkedLoading: true,
        iconCreateFunction: (c) => {
          const n = c.getChildCount();
          const sz = n < 10 ? 40 : n < 50 ? 48 : 58;
          return L.divIcon({ className: 'cl-wrap', html: `<div class="cl" style="--s:${sz}px"><span>${n}</span></div>`, iconSize: [sz, sz] });
        },
      });
      pointGroup._isCluster = true;
    } else pointGroup = L.layerGroup();
    pointGroup.addTo(map);
  };

  /* ---------- Render ---------- */
  function isVisible(it) {
    if (forcedId === it.id) return true;
    const c = D.catById(it.categoryId);
    if (c && !c.visible) return false;
    const tf = D.state.tagFilter;
    if (tf.size && !it.tags.some((t) => tf.has(t))) return false;
    return true;
  }
  M.isVisible = isVisible;

  function popTooltip(layer, item, st, kind) {
    layer.unbindTooltip();
    const permanent = kind === 'point' && D.state.project.settings.labels;
    layer.bindTooltip(D.esc(item.title), {
      direction: kind === 'point' ? (permanent ? 'right' : 'top') : 'auto', sticky: kind !== 'point', permanent,
      className: 'dr-tt', opacity: 1, offset: permanent ? [8, -((D.SIZES[st.size] || 38) * 0.6)] : [0, 0],
    });
  }

  function buildShape(item, selected) {
    const st = D.styleOf(item);
    if (item.type === 'line') {
      const hit = L.polyline(item.coords, { weight: 20, opacity: 0, interactive: true });
      const line = L.polyline(item.coords, { color: st.color, weight: st.weight + (selected ? 2 : 0), opacity: 0.95, lineCap: 'round', lineJoin: 'round', dashArray: st.dash ? '1 9' : null, interactive: false, className: 'dr-shape' + (selected ? ' is-selected' : '') });
      const g = L.featureGroup([hit, line]);
      return { layer: g, parts: { hit, line }, events: hit };
    }
    const poly = L.polygon(item.coords, { color: st.color, weight: st.weight + (selected ? 1 : 0), opacity: 0.95, fillColor: st.color, fillOpacity: Math.min(0.9, st.fill + (selected ? 0.14 : 0)), lineJoin: 'round', dashArray: st.dash ? '2 8' : null, className: 'dr-shape' + (selected ? ' is-selected' : '') });
    return { layer: poly, parts: { poly }, events: poly };
  }

  function wire(id, target) {
    target.on('click', (e) => {
      if (D.state.touring) { L.DomEvent.stopPropagation(e); return D.emit('tour-click', id); }
      if (D.state.tool !== 'select') return; // dibujando: el clic llega al mapa y añade vértice
      L.DomEvent.stopPropagation(e);
      if (D.state.editing) return D.toast('Termina de editar antes de cambiar de elemento', { kind: 'warn' });
      M.select(id);
      M.nudgeIntoView(id);
    });
    target.on('contextmenu', (e) => { L.DomEvent.stopPropagation(e); D.emit('item-context', { id, e }); });
    target.on('mouseover', () => { const en = reg.get(id); if (en && en.parts && en.parts.line) en.parts.line.getElement() && en.parts.line.getElement().classList.add('is-hover'); if (en && en.parts && en.parts.poly) en.parts.poly.getElement() && en.parts.poly.getElement().classList.add('is-hover'); });
    target.on('mouseout', () => { const en = reg.get(id); if (en && en.parts && en.parts.line) en.parts.line.getElement() && en.parts.line.getElement().classList.remove('is-hover'); if (en && en.parts && en.parts.poly) en.parts.poly.getElement() && en.parts.poly.getElement().classList.remove('is-hover'); });
  }

  function detach(e) {
    if (!e || !e.shown) return;
    (e.kind === 'point' ? pointGroup : shapeGroup).removeLayer(e.layer);
    e.shown = false;
  }
  function removeLayer(id) {
    const e = reg.get(id);
    if (!e) return;
    detach(e);
    reg.delete(id);
  }

  function applyItem(item, selectedOverride) {
    if (!item) return;
    const selected = selectedOverride != null ? selectedOverride : D.state.selectedId === item.id;
    let e = reg.get(item.id);
    const st = D.styleOf(item);
    if (item.type === 'point') {
      if (e && e.kind === 'point') {
        e.item = item;
        e.layer.setIcon(buildIcon(item, selected));
        e.layer.setLatLng(item.coords);
        popTooltip(e.layer, item, st, 'point');
        return;
      }
      if (e) removeLayer(item.id);
      const mk = L.marker(item.coords, { icon: buildIcon(item, selected), riseOnHover: true, keyboard: false, draggable: false });
      popTooltip(mk, item, st, 'point');
      wire(item.id, mk);
      reg.set(item.id, { item, kind: 'point', layer: mk, shown: false });
      return;
    }
    // formas: se reconstruyen al cambiar (son baratas)
    if (e) removeLayer(item.id);
    const b = buildShape(item, selected);
    popTooltip(b.events, item, st, 'shape');
    wire(item.id, b.events);
    reg.set(item.id, { item, kind: item.type, layer: b.layer, parts: b.parts, shown: false });
  }

  function applyVisibility() {
    const toAdd = [], toRemove = [];
    reg.forEach((e) => {
      if (e.preview) return;
      const vis = isVisible(e.item);
      if (vis && !e.shown) toAdd.push(e);
      else if (!vis && e.shown) toRemove.push(e);
    });
    toRemove.forEach(detach);
    const pts = toAdd.filter((e) => e.kind === 'point');
    if (pts.length > 1 && pointGroup.addLayers) pointGroup.addLayers(pts.map((e) => e.layer));
    else pts.forEach((e) => pointGroup.addLayer(e.layer));
    pts.forEach((e) => (e.shown = true));
    toAdd.filter((e) => e.kind !== 'point').forEach((e) => { shapeGroup.addLayer(e.layer); e.shown = true; });
    D.emit('visibility');
  }
  M.applyVisibility = applyVisibility;

  M.renderAll = () => {
    reg.forEach((e) => detach(e));
    reg.clear();
    if (pointGroup.clearLayers) pointGroup.clearLayers();
    shapeGroup.clearLayers();
    D.state.project.items.forEach((it) => applyItem(it));
    applyVisibility();
  };

  /* Vista previa mientras se edita (no toca el almacén; fuera de la agrupación para que no se esconda) */
  M.preview = (draft) => {
    const e = reg.get(draft.id);
    const oldLayer = e && e.layer;
    const wasPrev = !!(e && e.preview);
    if (e && e.shown) detach(e);
    applyItem(draft, true);
    const n = reg.get(draft.id);
    if (wasPrev && n.layer !== oldLayer) previewGroup.removeLayer(oldLayer);
    n.preview = true;
    n.shown = false;
    if (!previewGroup.hasLayer(n.layer)) previewGroup.addLayer(n.layer);
  };
  M.restore = (id) => {
    const e = reg.get(id);
    if (e && e.preview) { previewGroup.removeLayer(e.layer); reg.delete(id); }
    const it = D.itemById(id);
    if (it) { applyItem(it); applyVisibility(); }
  };
  M.layerEntry = (id) => reg.get(id);
  M.forceVisible = (id) => { forcedId = id; applyVisibility(); };

  /* ---------- Selección ---------- */
  M.select = (id) => {
    const prev = D.state.selectedId;
    if (prev === id) return;
    if (D.state.editing && id !== D.state.editing) return;
    D.state.selectedId = id;
    if (prev && D.itemById(prev)) applyItem(D.itemById(prev), false);
    if (id && D.itemById(id)) applyItem(D.itemById(id), true);
    if (id) { const e = reg.get(id); if (e && !e.shown) applyVisibility(); }
    D.emit('selection', { id, prev });
  };

  /* ---------- Márgenes libres (paneles que tapan el mapa) ---------- */
  M.insets = () => {
    const w = (sel) => {
      const el = D.$(sel);
      if (!el || !el.classList.contains('is-open')) return 0;
      const r = el.getBoundingClientRect();
      return r.width > 0 && window.innerWidth > 760 ? r.width + 28 : 0;
    };
    return { l: 0, r: w('#detail') || w('#tourPanel'), t: 70, b: document.body.classList.contains('is-tour') ? 90 : 76 };
  };
  M.centerFor = (ll, zoom) => {
    const ins = M.insets();
    const p = map.project(L.latLng(ll), zoom).add([(ins.r - ins.l) / 2, (ins.b - ins.t) / 2]);
    return map.unproject(p, zoom);
  };
  M.nudgeIntoView = (id) => {
    const it = typeof id === 'object' ? id : D.itemById(id);
    if (!it) return;
    const ll = it.type === 'point' ? it.coords : D.geo.centroid(it.coords);
    const ins = M.insets();
    const size = map.getSize();
    const pt = map.latLngToContainerPoint(ll);
    let dx = 0, dy = 0;
    if (pt.x > size.x - ins.r - 50) dx = pt.x - (size.x - ins.r - 90);
    if (pt.x < 60) dx = pt.x - 120;
    if (pt.y < ins.t + 70) dy = pt.y - (ins.t + 110);
    if (pt.y > size.y - ins.b - 30) dy = pt.y - (size.y - ins.b - 80);
    if (dx || dy) map.panBy([dx, dy], { animate: !reduceMotion(), duration: 0.5 });
  };

  /* ---------- Vuelos ---------- */
  M.flyToItem = (item, { zoom, duration, padding = 48, minZoom } = {}) => {
    if (!item) return Promise.resolve();
    const ins = M.insets();
    const dur = duration != null ? duration : D.state.project.settings.flyDuration;
    return new Promise((res) => {
      const done = () => { map.off('moveend', done); clearTimeout(tm); res(); };
      const tm = setTimeout(done, dur * 1000 + 900);
      map.once('moveend', done);
      if (item.type === 'point') {
        let z = zoom || Math.max(map.getZoom(), minZoom || 15);
        z = Math.min(z, map.getMaxZoom());
        const c = M.centerFor(item.coords, z);
        if (reduceMotion()) map.setView(c, z, { animate: false });
        else map.flyTo(c, z, { duration: dur, easeLinearity: 0.25 });
      } else {
        const b = L.latLngBounds(item.coords);
        const opt = { paddingTopLeft: [ins.l + padding, ins.t + padding], paddingBottomRight: [ins.r + padding, ins.b + padding], maxZoom: zoom || 18 };
        if (reduceMotion()) map.fitBounds(b, Object.assign({ animate: false }, opt));
        else map.flyToBounds(b, Object.assign({ duration: dur }, opt));
      }
    });
  };
  M.fitItems = (items, { animate = true, duration } = {}) => {
    const pts = [];
    items.forEach((it) => (it.type === 'point' ? pts.push(it.coords) : it.coords.forEach((c) => pts.push(c))));
    if (!pts.length) return Promise.resolve();
    const ins = M.insets();
    const b = L.latLngBounds(pts);
    return new Promise((res) => {
      const tm = setTimeout(res, (duration || 1.2) * 1000 + 800);
      map.once('moveend', () => { clearTimeout(tm); res(); });
      const opt = { paddingTopLeft: [ins.l + 60, ins.t + 40], paddingBottomRight: [ins.r + 60, ins.b + 40], maxZoom: 16 };
      if (!animate || reduceMotion()) map.fitBounds(b, Object.assign({ animate: false }, opt));
      else map.flyToBounds(b, Object.assign({ duration: duration || 1.4 }, opt));
    });
  };
  M.fitAll = (o) => M.fitItems(D.state.project.items.filter(isVisible), o);

  /* ---------- Elementos temporales ---------- */
  M.pulseAt = (ll, color = '#C9A862') => {
    const ic = L.divIcon({ className: 'pulse-wrap', html: `<span class="pulse" style="--c:${color}"></span>`, iconSize: [60, 60], iconAnchor: [30, 30] });
    const m = L.marker(ll, { icon: ic, interactive: false, keyboard: false }).addTo(tempLayer);
    setTimeout(() => tempLayer.removeLayer(m), 2600);
  };
  M.showTemp = (ll, html) => {
    tempLayer.clearLayers();
    const ic = L.divIcon({ className: 'mk-wrap', html: M.markerHTML({ color: '#F2EDE0', icon: 'search', size: 'm', shape: 'pin' }, true).replace('<svg class="mk__glyph" viewBox="0 0 24 24"', '<svg class="mk__glyph" viewBox="0 0 24 24"'), iconSize: [38, 49], iconAnchor: [19, 48] });
    const m = L.marker(ll, { icon: ic, keyboard: false }).addTo(tempLayer);
    if (html) m.bindPopup(html, { className: 'dr-pop', closeButton: false, offset: [0, -40], minWidth: 220, maxWidth: 280 }).openPopup();
    return m;
  };
  M.clearTemp = () => tempLayer.clearLayers();
  M.tempLayer = () => tempLayer;
})();

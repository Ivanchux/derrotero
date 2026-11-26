/* Derrotero · herramientas: colocar puntos, dibujar líneas y áreas, editar vértices */
(function () {
  'use strict';
  const D = window.Derrotero;
  const L = window.L;
  const T = (D.tools = {});
  const BRASS = '#C9A862';
  let drawing = null;
  let editing = null;

  const map = () => D.map.map;
  const inField = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  T.set = (tool) => {
    if (drawing) cancelDraw(true);
    D.state.tool = tool;
    document.body.classList.remove('tool-select', 'tool-point', 'tool-line', 'tool-area');
    document.body.classList.add('tool-' + tool);
    if (tool === 'line' || tool === 'area') startDraw(tool);
    if (tool === 'point') showHud({ text: 'Haz clic en el mapa para colocar el punto', pt: true });
    if (tool === 'select') hideHud();
    D.emit('tool', tool);
  };

  /* ---------- HUD ---------- */
  function showHud({ text, measure = '', pt = false }) {
    const h = D.$('#hud');
    D.$('.hud__text', h).textContent = text;
    D.$('.hud__measure', h).textContent = measure;
    D.$('[data-hud=finish]', h).hidden = pt;
    D.$('[data-hud=undo]', h).hidden = pt;
    h.classList.add('is-open');
  }
  function hideHud() { D.$('#hud').classList.remove('is-open'); }

  /* ---------- Clic en el mapa ---------- */
  T.init = () => {
    const m = map();
    m.on('click', (e) => {
      if (D.state.tool === 'point') {
        const ll = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)];
        T.set('select');
        D.emit('draw-complete', { type: 'point', coords: ll });
      } else if (drawing) addVertex(e.latlng);
    });
    m.on('mousemove', (e) => { if (drawing) moveRubber(e.latlng); });
    m.on('dblclick', (e) => { if (drawing) { L.DomEvent.stop(e); finishDraw(); } });
    D.$('[data-hud=finish]').onclick = () => finishDraw();
    D.$('[data-hud=undo]').onclick = () => undoVertex();
    D.$('[data-hud=cancel]').onclick = () => T.set('select');
    document.addEventListener('keydown', (e) => {
      if (inField(e)) return;
      if (drawing) {
        if (e.key === 'Enter') { e.preventDefault(); finishDraw(); }
        else if (e.key === 'Backspace') { e.preventDefault(); undoVertex(); }
      }
      if (e.key === 'Escape' && (drawing || D.state.tool !== 'select')) { e.preventDefault(); T.set('select'); }
    });
  };

  /* ---------- Dibujo ---------- */
  function startDraw(kind) {
    const m = map();
    m.doubleClickZoom.disable();
    const style = { color: BRASS, weight: 3, dashArray: '7 8', className: 'dr-draw', interactive: false };
    const poly = kind === 'area' ? L.polygon([], Object.assign({ fillColor: BRASS, fillOpacity: 0.14 }, style)) : L.polyline([], style);
    const rubber = L.polyline([], { color: BRASS, weight: 2, opacity: 0.75, dashArray: '2 7', interactive: false, className: 'dr-draw' });
    const g = L.layerGroup([poly, rubber]).addTo(m);
    drawing = { kind, pts: [], poly, rubber, g, vms: [] };
    updateHud();
  }
  function addVertex(ll) {
    const d = drawing;
    const last = d.pts[d.pts.length - 1];
    if (last && map().latLngToContainerPoint(last).distanceTo(map().latLngToContainerPoint(ll)) < 4) return;
    d.pts.push(L.latLng(ll));
    d.poly.setLatLngs(d.pts);
    const first = d.pts.length === 1;
    const vm = L.circleMarker(ll, { radius: first && d.kind === 'area' ? 7 : 5, color: BRASS, weight: 2, fillColor: '#0A1424', fillOpacity: 1, className: 'dr-vtx' });
    if (first && d.kind === 'area') vm.on('click', (e) => { L.DomEvent.stop(e); if (d.pts.length >= 3) finishDraw(); });
    vm.addTo(d.g);
    d.vms.push(vm);
    updateHud();
  }
  function undoVertex() {
    const d = drawing;
    if (!d || !d.pts.length) return;
    d.pts.pop();
    d.g.removeLayer(d.vms.pop());
    d.poly.setLatLngs(d.pts);
    d.rubber.setLatLngs([]);
    updateHud();
  }
  function moveRubber(ll) {
    const d = drawing;
    if (!d.pts.length) return;
    const last = d.pts[d.pts.length - 1];
    d.rubber.setLatLngs(d.kind === 'area' && d.pts.length > 1 ? [last, ll, d.pts[0]] : [last, ll]);
    d.cursor = ll;
    updateHud();
  }
  function updateHud() {
    const d = drawing;
    if (!d) return;
    const pts = d.pts.map((p) => [p.lat, p.lng]);
    if (d.cursor && d.pts.length) pts.push([d.cursor.lat, d.cursor.lng]);
    const kindTxt = d.kind === 'line' ? 'línea' : 'área';
    const min = d.kind === 'line' ? 2 : 3;
    const text = d.pts.length < min ? `Dibujando ${kindTxt}: haz clic para añadir vértices` : 'Doble clic o Intro para terminar · Retroceso quita el último';
    const measure = d.kind === 'line' ? (pts.length > 1 ? D.geo.fmtLen(D.geo.length(pts)) : '') : (pts.length > 2 ? D.geo.fmtArea(D.geo.area(pts)) + ' · ' + D.geo.fmtLen(D.geo.length(pts, true)) : '');
    showHud({ text, measure });
    D.$('[data-hud=finish]').disabled = d.pts.length < min;
    D.$('[data-hud=undo]').disabled = !d.pts.length;
  }
  function endDraw() {
    const d = drawing;
    if (!d) return;
    map().removeLayer(d.g);
    map().doubleClickZoom.enable();
    drawing = null;
  }
  function cancelDraw() { endDraw(); hideHud(); }
  function finishDraw() {
    const d = drawing;
    if (!d) return;
    const m = map();
    // quita duplicados finales (el doble clic añade el último vértice dos veces)
    const pts = d.pts.filter((p, i, a) => !i || m.latLngToContainerPoint(a[i - 1]).distanceTo(m.latLngToContainerPoint(p)) >= 4);
    const min = d.kind === 'line' ? 2 : 3;
    if (pts.length < min) return D.toast(`Hacen falta al menos ${min} vértices`, { kind: 'warn' });
    const kind = d.kind;
    const coords = pts.map((p) => [+p.lat.toFixed(6), +p.lng.toFixed(6)]);
    endDraw();
    T.set('select');
    D.emit('draw-complete', { type: kind, coords });
  }

  /* ---------- Edición de vértices y movimiento de puntos ---------- */
  T.stopEdit = () => {
    if (!editing) return;
    if (editing.group) map().removeLayer(editing.group);
    if (editing.marker) {
      editing.marker.dragging.disable();
      editing.marker.off('dragend', editing.onEnd);
    }
    editing = null;
  };

  T.editPoint = (item, onChange) => {
    T.stopEdit();
    const en = D.map.layerEntry(item.id);
    if (!en) return;
    const mk = en.layer;
    const onEnd = () => { const p = mk.getLatLng(); onChange([+p.lat.toFixed(6), +p.lng.toFixed(6)]); };
    mk.dragging.enable();
    mk.on('dragend', onEnd);
    editing = { marker: mk, onEnd };
  };

  const vtxIcon = L.divIcon({ className: 'vtx-wrap', html: '<span class="vtx"></span>', iconSize: [18, 18] });
  const midIcon = L.divIcon({ className: 'vtx-wrap', html: '<span class="vtx vtx--mid"></span>', iconSize: [14, 14] });

  T.editVertices = (item, onChange) => {
    T.stopEdit();
    const m = map();
    const closed = item.type === 'area';
    const min = closed ? 3 : 2;
    const coords = item.coords.map((c) => c.slice());
    const group = L.layerGroup().addTo(m);
    editing = { group };
    const emit = (live) => onChange(coords.map((c) => c.slice()), { live });
    const build = () => {
      group.clearLayers();
      coords.forEach((c, i) => {
        const v = L.marker(c, { icon: vtxIcon, draggable: true, keyboard: false, zIndexOffset: 800 }).addTo(group);
        v.on('drag', () => { const p = v.getLatLng(); coords[i] = [p.lat, p.lng]; emit(true); });
        v.on('dragend', () => { const p = v.getLatLng(); coords[i] = [+p.lat.toFixed(6), +p.lng.toFixed(6)]; emit(false); build(); });
        const del = (e) => {
          L.DomEvent.stop(e);
          if (coords.length <= min) return D.toast(`Una ${closed ? 'área' : 'línea'} necesita al menos ${min} vértices`, { kind: 'warn' });
          coords.splice(i, 1);
          emit(false);
          build();
        };
        v.on('dblclick', del);
        v.on('contextmenu', del);
      });
      const segs = closed ? coords.length : coords.length - 1;
      for (let i = 0; i < segs; i++) {
        const a = coords[i], b = coords[(i + 1) % coords.length];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const mm = L.marker(mid, { icon: midIcon, keyboard: false, zIndexOffset: 700 }).addTo(group);
        mm.on('click', (e) => { L.DomEvent.stop(e); coords.splice(i + 1, 0, [+mid[0].toFixed(6), +mid[1].toFixed(6)]); emit(false); build(); });
      }
    };
    build();
  };

  T.isDrawing = () => !!drawing;
})();

/* Derrotero · editor de elementos: título, categoría, aspecto, texto con formato, imágenes, enlaces y etiquetas */
(function () {
  'use strict';
  const D = window.Derrotero;
  const E = (D.editor = {});
  const $ = D.$;
  const esc = D.esc;
  const typeName = { point: 'punto', line: 'línea', area: 'área' };
  let draft = null, orig = null, isNew = false, offs = [], lastCat = null;

  /* ---------- Entrada ---------- */
  E.create = ({ type, coords }) => {
    if (D.state.mode === 'view') return;
    if (D.state.editing) return D.toast('Termina de editar el elemento actual', { kind: 'warn' });
    const cats = D.state.project.categories;
    const cat = cats.find((c) => c.id === lastCat) || cats.find((c) => c.visible) || cats[0];
    draft = { id: D.uid('i'), type, categoryId: cat.id, title: '', description: '', tags: [], links: [], images: [], style: null, coords, createdAt: Date.now() };
    isNew = true;
    orig = JSON.stringify(draft);
    start();
  };
  E.open = (id) => {
    if (D.state.mode === 'view') return;
    const it = D.itemById(id);
    if (!it) return;
    if (D.state.editing) return;
    D.map.select(id);
    draft = JSON.parse(JSON.stringify(it));
    isNew = false;
    orig = JSON.stringify(draft);
    start();
  };
  D.on('draw-complete', E.create);
  D.on('project', () => { if (draft) teardown(true); });

  const dirty = () => {
    if (!draft) return false;
    if (isNew) return !!(draft.title || draft.description || draft.images.length || draft.links.length || draft.tags.length || draft.style);
    return JSON.stringify(draft) !== orig;
  };

  /* ---------- Ciclo de vida ---------- */
  function start() {
    D.state.editing = draft.id;
    D.state.selectedId = draft.id;
    D.ui.closePopover();
    const panel = $('#detail');
    panel.classList.add('is-open', 'is-editing');
    render(panel);
    D.map.preview(draft);
    D.map.nudgeIntoView(draft);
    armMoving();
    const keyh = (e) => {
      if (e.key === 'Escape' && !$('#modals').children.length && !$('#popover').classList.contains('is-open')) { e.preventDefault(); E.cancel(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); E.save(); }
    };
    document.addEventListener('keydown', keyh);
    offs = [() => document.removeEventListener('keydown', keyh), D.on('categories', refreshCats)];
    setTimeout(() => { const t = $('#edTitle'); if (t) t.focus(); }, 380);
  }
  function armMoving() {
    if (draft.type === 'point') D.tools.editPoint(draft, (ll) => { draft.coords = ll; D.map.preview(draft); updateMeasure(); });
    else D.tools.editVertices(draft, (coords) => { draft.coords = coords; D.map.preview(draft); updateMeasure(); });
  }
  function teardown(closePanel) {
    D.tools.stopEdit();
    offs.forEach((f) => f());
    offs = [];
    const id = draft && draft.id;
    D.state.editing = null;
    if (id) D.map.restore(id);
    draft = null;
    $('#detail').classList.remove('is-editing');
    if (closePanel) { D.state.selectedId = null; D.ui.closeDetail(); }
    return id;
  }
  E.cancel = async () => {
    if (!draft) return;
    if (dirty() && !(await D.confirm({ title: 'Descartar cambios', text: 'Has modificado este elemento y no lo has guardado.', ok: 'Descartar', danger: true }))) return;
    const wasNew = isNew;
    const id = teardown();
    if (wasNew) { D.state.selectedId = null; D.ui.closeDetail(); D.emit('selection', { id: null, prev: id }); }
    else D.ui.openDetail(id);
  };
  E.save = () => {
    if (!draft) return;
    const form = $('#edForm');
    // enlaces: validar antes de cerrar
    const links = [];
    for (const row of D.$$('.linkrow', form)) {
      const label = $('.lbl', row).value.trim(), raw = $('.url', row).value.trim();
      if (!raw && !label) continue;
      const url = D.safeUrl(raw);
      if (!url) { D.toast('Revisa el enlace «' + (label || raw) + '»: debe empezar por https://', { kind: 'warn' }); $('.url', row).focus(); return; }
      links.push({ label, url });
    }
    draft.links = links;
    draft.title = ($('#edTitle').value || '').trim() || 'Nuevo ' + typeName[draft.type];
    draft.description = D.sanitize(draft.description);
    if (!D.htmlToText(draft.description) && !/<hr/.test(draft.description)) draft.description = '';
    const clean = D.normalizeItem(draft, new Set(D.state.project.categories.map((c) => c.id)), draft.categoryId);
    if (!clean) return D.toast('No se pudo guardar el elemento: revisa sus coordenadas', { kind: 'warn' });
    lastCat = clean.categoryId;
    const cat = D.catById(clean.categoryId);
    const wasNew = isNew;
    teardown();
    D.state.selectedId = null;
    if (cat && !cat.visible) D.store.setVisible(cat.id, true);
    if (wasNew) D.store.addItem(clean);
    else D.store.updateItem(clean.id, clean);
    D.map.select(clean.id);
    D.toast(wasNew ? 'Elemento añadido' : 'Cambios guardados');
  };

  /* ---------- Vista del formulario ---------- */
  function catOptions() {
    return D.state.project.categories.map((c) => `<option value="${c.id}" ${c.id === draft.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  }
  function refreshCats(d) {
    if (!draft) return;
    const sel = $('#edCat');
    if (!sel) return;
    if (d && d.op === 'add') draft.categoryId = d.id;
    if (!D.catById(draft.categoryId)) draft.categoryId = D.state.project.categories[0].id;
    sel.innerHTML = catOptions();
    syncLook();
    D.map.preview(draft);
  }
  function render(panel) {
    const isPoint = draft.type === 'point';
    panel.innerHTML = `
      <div class="detail__bar"><span class="chip-cat chip-cat--edit">${D.icon(isPoint ? 'map-pin' : draft.type === 'line' ? 'spline' : 'pentagon', 14)}${isNew ? 'Nuevo' : 'Editando'} ${typeName[draft.type]}</span><span class="grow"></span>
        <button class="icon-btn" data-ed="cancel" title="Cerrar (Esc)">${D.icon('x')}</button></div>
      <form class="detail__scroll editor" id="edForm" autocomplete="off" onsubmit="return false">
        <input class="ed-title" id="edTitle" type="text" maxlength="160" placeholder="Nombre del ${typeName[draft.type]}" value="${esc(draft.title)}">
        <div class="field"><span>Categoría</span><div class="inline"><select id="edCat">${catOptions()}</select><button type="button" class="icon-btn" id="edAddCat" title="Nueva categoría">${D.icon('plus')}</button></div></div>

        <section class="fold is-open" id="foldLook"><button type="button" class="fold__h" data-fold>${D.icon('palette', 16)}<b>Aspecto</b><span class="grow"></span>${D.icon('chevron-down', 16)}</button>
          <div class="fold__b"><div class="fold__in" id="lookBody"></div></div></section>

        <div class="field"><span>Descripción</span><div id="edRte"></div></div>
        <div class="field"><span>Imágenes</span><div id="edImgs"></div></div>
        <div class="field"><span>Enlaces</span><div id="edLinks"></div></div>
        <div class="field"><span>Etiquetas</span><div id="edTags"></div></div>
        <p class="hint" id="edHint"></p>
      </form>
      <div class="editor__foot">
        ${isNew ? '<span class="grow"></span>' : `<button type="button" class="btn btn--danger-ghost" data-ed="delete">${D.icon('trash-2', 16)}Eliminar</button><span class="grow"></span>`}
        <button type="button" class="btn" data-ed="cancel">Cancelar</button>
        <button type="button" class="btn btn--primary" data-ed="save">${D.icon('check', 16)}Guardar</button>
      </div>`;
    $('#edTitle').addEventListener('input', (e) => { draft.title = e.target.value; D.map.preview(draft); });
    $('#edCat').addEventListener('change', (e) => { draft.categoryId = e.target.value; syncLook(); D.map.preview(draft); });
    $('#edAddCat').onclick = () => D.ui.categoryDialog(null);
    $('[data-fold]', panel).onclick = () => $('#foldLook').classList.toggle('is-open');
    panel.onclick = async (e) => {
      const b = e.target.closest('[data-ed]');
      if (!b) return;
      if (b.dataset.ed === 'cancel') E.cancel();
      else if (b.dataset.ed === 'save') E.save();
      else if (b.dataset.ed === 'delete') {
        const id = draft.id;
        if (dirty() && !(await D.confirm({ title: 'Eliminar elemento', text: 'Se eliminará «' + (draft.title || 'sin título') + '».', ok: 'Eliminar', danger: true }))) return;
        teardown(); D.state.selectedId = null; D.ui.closeDetail(); D.store.removeItem(id); D.emit('selection', { id: null, prev: id });
      }
    };
    buildLook();
    $('#edRte').appendChild(rte());
    buildImages();
    buildLinks();
    buildTags();
    updateMeasure();
  }

  /* ---------- Aspecto ---------- */
  function ensureStyle() { if (!draft.style) draft.style = {}; return draft.style; }
  function setStyle(k, v) {
    const s = ensureStyle();
    if (v == null) delete s[k]; else s[k] = v;
    if (!Object.keys(s).length) draft.style = null;
    D.map.preview(draft);
  }
  let lookRefs = {};
  function buildLook() {
    const body = $('#lookBody');
    const st = D.styleOf(draft);
    const s = draft.style || {};
    lookRefs = {};
    body.innerHTML = '';
    const row = (label, el, extra) => {
      const f = D.el(`<div class="field field--tight"><span>${label}</span></div>`);
      f.appendChild(el);
      if (extra) f.appendChild(extra);
      body.appendChild(f);
    };
    // color
    const cf = D.ui.colorField(st.color, (v) => { setStyle('color', v); lookRefs.inh.checked = false; });
    lookRefs.color = cf;
    const inh = D.el(`<label class="check"><input type="checkbox" ${s.color ? '' : 'checked'}><span>Usar el color de la categoría</span></label>`);
    lookRefs.inh = $('input', inh);
    lookRefs.inh.addEventListener('change', (e) => { if (e.target.checked) { setStyle('color', null); cf.set(D.styleOf(draft).color); } else setStyle('color', D.styleOf(draft).color); });
    row('Color', cf, inh);
    if (draft.type === 'point') {
      const ib = D.el(`<button type="button" class="btn btn--icon" id="edIcon">${D.icon(st.icon, 18)}<span>Cambiar icono</span></button>`);
      ib.onclick = () => D.ui.iconPicker(ib, D.styleOf(draft).icon, (k) => { setStyle('icon', k); ib.innerHTML = D.icon(k, 18) + '<span>Cambiar icono</span>'; });
      lookRefs.icon = ib;
      row('Icono', ib);
      row('Tamaño', D.ui.seg([{ v: 's', label: 'S' }, { v: 'm', label: 'M' }, { v: 'l', label: 'L' }, { v: 'xl', label: 'XL' }], st.size, (v) => setStyle('size', v === 'm' ? null : v)));
      row('Forma', D.ui.seg([{ v: 'pin', label: 'Chincheta' }, { v: 'circle', label: 'Círculo' }], st.shape, (v) => setStyle('shape', v === 'pin' ? null : v)));
    } else {
      const w = D.el(`<div class="range"><input type="range" min="1" max="12" step="1" value="${st.weight}"><em>${st.weight} px</em></div>`);
      $('input', w).addEventListener('input', (e) => { $('em', w).textContent = e.target.value + ' px'; setStyle('weight', +e.target.value); });
      row('Grosor del trazo', w);
      if (draft.type === 'area') {
        const f = D.el(`<div class="range"><input type="range" min="0" max="0.8" step="0.02" value="${st.fill}"><em>${Math.round(st.fill * 100)} %</em></div>`);
        $('input', f).addEventListener('input', (e) => { $('em', f).textContent = Math.round(e.target.value * 100) + ' %'; setStyle('fill', +e.target.value); });
        row('Opacidad del relleno', f);
      }
      row('Trazo punteado', D.ui.switchEl(st.dash, (v) => setStyle('dash', v ? true : null)));
    }
  }
  function syncLook() {
    if (!lookRefs.color) return;
    const st = D.styleOf(draft);
    if (!(draft.style && draft.style.color)) lookRefs.color.set(st.color);
    if (lookRefs.icon && !(draft.style && draft.style.icon)) lookRefs.icon.innerHTML = D.icon(st.icon, 18) + '<span>Cambiar icono</span>';
  }

  /* ---------- Texto con formato ---------- */
  function rte() {
    const el = D.el(`<div class="rte">
      <div class="rte__bar">
        <button type="button" data-c="bold" title="Negrita (Ctrl+B)">${D.icon('bold', 16)}</button>
        <button type="button" data-c="italic" title="Cursiva (Ctrl+I)">${D.icon('italic', 16)}</button>
        <button type="button" data-c="underline" title="Subrayado (Ctrl+U)">${D.icon('underline', 16)}</button>
        <span class="rte__sep"></span>
        <button type="button" data-c="h3" title="Subtítulo">${D.icon('heading-2', 16)}</button>
        <button type="button" data-c="quote" title="Cita">${D.icon('quote', 16)}</button>
        <button type="button" data-c="ul" title="Lista">${D.icon('list', 16)}</button>
        <button type="button" data-c="ol" title="Lista numerada">${D.icon('list-ordered', 16)}</button>
        <span class="rte__sep"></span>
        <button type="button" data-c="link" title="Enlace">${D.icon('link', 16)}</button>
        <button type="button" data-c="clear" title="Quitar formato">${D.icon('eraser', 16)}</button>
      </div>
      <div class="rte__link" hidden><input type="text" placeholder="https://…"><button type="button" class="btn btn--sm btn--primary" data-l="ok">Aplicar</button><button type="button" class="btn btn--sm" data-l="rm">Quitar enlace</button></div>
      <div class="rte__area rich" contenteditable="true" data-ph="Qué es, por qué importa, cifras clave…"></div></div>`);
    const area = $('.rte__area', el), linkBox = $('.rte__link', el);
    area.innerHTML = draft.description;
    let saved = null;
    const changed = () => { draft.description = area.innerHTML; };
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* ignora */ }
    const block = (tag) => {
      const cur = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
      document.execCommand('formatBlock', false, cur === tag ? 'p' : tag);
    };
    $('.rte__bar', el).addEventListener('mousedown', (e) => e.preventDefault());
    $('.rte__bar', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      area.focus();
      const c = b.dataset.c;
      if (c === 'bold' || c === 'italic' || c === 'underline') document.execCommand(c);
      else if (c === 'h3') block('h3');
      else if (c === 'quote') block('blockquote');
      else if (c === 'ul') document.execCommand('insertUnorderedList');
      else if (c === 'ol') document.execCommand('insertOrderedList');
      else if (c === 'clear') { document.execCommand('removeFormat'); document.execCommand('unlink'); document.execCommand('formatBlock', false, 'p'); }
      else if (c === 'link') {
        const sel = getSelection();
        saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        linkBox.hidden = !linkBox.hidden;
        if (!linkBox.hidden) { $('input', linkBox).value = ''; $('input', linkBox).focus(); }
        return;
      }
      changed(); active();
    });
    linkBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]');
      if (!b) return;
      area.focus();
      const sel = getSelection();
      if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
      if (b.dataset.l === 'rm') document.execCommand('unlink');
      else {
        const url = D.safeUrl($('input', linkBox).value);
        if (!url) return D.toast('Escribe una dirección válida, por ejemplo https://…', { kind: 'warn' });
        if (sel.isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(D.domain(url))}</a>`);
        else document.execCommand('createLink', false, url);
      }
      linkBox.hidden = true;
      changed();
    });
    $('input', linkBox).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-l=ok]', linkBox).click(); } });
    area.addEventListener('input', changed);
    area.addEventListener('blur', changed);
    area.addEventListener('paste', (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const txt = e.clipboardData.getData('text/plain');
      if (html) document.execCommand('insertHTML', false, D.sanitize(html));
      else document.execCommand('insertHTML', false, D.esc(txt).replace(/\n/g, '<br>'));
      changed();
    });
    const active = () => {
      D.$$('[data-c]', el).forEach((b) => {
        const c = b.dataset.c;
        let on = false;
        try {
          if (['bold', 'italic', 'underline'].includes(c)) on = document.queryCommandState(c);
          else if (c === 'ul') on = document.queryCommandState('insertUnorderedList');
          else if (c === 'ol') on = document.queryCommandState('insertOrderedList');
          else if (c === 'h3' || c === 'quote') on = String(document.queryCommandValue('formatBlock')).toLowerCase().replace(/[<>]/g, '') === (c === 'h3' ? 'h3' : 'blockquote');
        } catch (e2) { /* ignora */ }
        b.classList.toggle('is-on', !!on);
      });
    };
    area.addEventListener('keyup', active);
    area.addEventListener('mouseup', active);
    return el;
  }

  /* ---------- Imágenes ---------- */
  function buildImages() {
    const host = $('#edImgs');
    host.innerHTML = `<div class="imgs__list"></div>
      <label class="drop"><input type="file" accept="image/*" multiple hidden>${D.icon('image-plus', 22)}<span><b>Sube imágenes</b> desde tu equipo<br><small>Se redimensionan y se guardan dentro del mapa. También puedes soltarlas aquí.</small></span></label>
      <div class="inline"><input type="text" class="imgurl" placeholder="…o pega un enlace a una imagen (https://…)"><button type="button" class="btn btn--sm">Añadir</button></div>`;
    const list = $('.imgs__list', host), drop = $('.drop', host), fi = $('input[type=file]', host), url = $('.imgurl', host);
    const draw = () => {
      list.innerHTML = draft.images.map((im, i) => `<div class="imgrow" data-i="${i}"><img src="${esc(im.src)}" alt="" referrerpolicy="no-referrer"><input type="text" class="cap" maxlength="200" placeholder="Pie de foto (opcional)" value="${esc(im.caption || '')}">
        <div class="imgrow__act"><button type="button" data-m="-1" title="Mover antes" ${i === 0 ? 'disabled' : ''}>${D.icon('chevron-up', 15)}</button><button type="button" data-m="1" title="Mover después" ${i === draft.images.length - 1 ? 'disabled' : ''}>${D.icon('chevron-down', 15)}</button><button type="button" data-m="x" title="Quitar" class="is-danger">${D.icon('x', 15)}</button></div></div>`).join('');
    };
    draw();
    list.addEventListener('input', (e) => { if (e.target.classList.contains('cap')) draft.images[+e.target.closest('.imgrow').dataset.i].caption = e.target.value; });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const i = +b.closest('.imgrow').dataset.i;
      if (b.dataset.m === 'x') draft.images.splice(i, 1);
      else { const j = i + +b.dataset.m; [draft.images[i], draft.images[j]] = [draft.images[j], draft.images[i]]; }
      draw();
    });
    const addFiles = async (files) => {
      files = Array.from(files).filter((f) => /^image\//.test(f.type));
      if (!files.length) return D.toast('Solo se admiten imágenes', { kind: 'warn' });
      drop.classList.add('is-busy');
      try {
        for (const f of files) draft.images.push({ src: await D.fileToImage(f), caption: '' });
        draw();
      } catch (err) { console.error(err); D.toast('No se pudo leer alguna imagen', { kind: 'warn' }); }
      drop.classList.remove('is-busy');
    };
    fi.addEventListener('change', () => { addFiles(fi.files); fi.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
    const addUrl = () => {
      const u = D.safeImg(url.value.trim().match(/^[\w-]+(\.[\w-]+)+\//) ? 'https://' + url.value.trim() : url.value.trim());
      if (!u) return D.toast('Escribe un enlace de imagen que empiece por https://', { kind: 'warn' });
      draft.images.push({ src: u, caption: '' });
      url.value = '';
      draw();
    };
    $('.inline .btn', host).onclick = addUrl;
    url.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } });
  }

  /* ---------- Enlaces ---------- */
  function buildLinks() {
    const host = $('#edLinks');
    host.innerHTML = '<div class="links-list"></div><button type="button" class="btn btn--sm" id="addLink">' + D.icon('plus', 15) + 'Añadir enlace</button>';
    const list = $('.links-list', host);
    const add = (l = { label: '', url: '' }) => {
      const r = D.el(`<div class="linkrow"><input class="lbl" type="text" maxlength="80" placeholder="Texto (ej. Web oficial)" value="${esc(l.label)}"><input class="url" type="text" placeholder="https://…" value="${esc(l.url)}"><button type="button" class="icon-btn icon-btn--sm" title="Quitar">${D.icon('x', 15)}</button></div>`);
      $('button', r).onclick = () => r.remove();
      list.appendChild(r);
    };
    draft.links.forEach(add);
    $('#addLink').onclick = () => { add(); const rows = D.$$('.linkrow', list); $('.lbl', rows[rows.length - 1]).focus(); };
  }

  /* ---------- Etiquetas ---------- */
  function buildTags() {
    const host = $('#edTags');
    host.innerHTML = '<div class="chips"></div><input type="text" class="chips__in" list="tagList" placeholder="Escribe y pulsa Intro…" maxlength="40"><datalist id="tagList"></datalist>';
    const chips = $('.chips', host), inp = $('.chips__in', host);
    $('#tagList', host).innerHTML = D.allTags().map(([t]) => `<option value="${esc(t)}">`).join('');
    const draw = () => { chips.innerHTML = draft.tags.map((t, i) => `<span class="chip">#${esc(t)}<button type="button" data-i="${i}" aria-label="Quitar">${D.icon('x', 12)}</button></span>`).join(''); };
    const add = (v) => { v = v.replace(/^#/, '').trim(); if (v && !draft.tags.includes(v)) { draft.tags.push(v); draw(); } inp.value = ''; };
    draw();
    chips.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { draft.tags.splice(+b.dataset.i, 1); draw(); } });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(inp.value); }
      else if (e.key === 'Backspace' && !inp.value && draft.tags.length) { draft.tags.pop(); draw(); }
    });
    inp.addEventListener('change', () => add(inp.value));
    inp.addEventListener('blur', () => add(inp.value));
  }

  function updateMeasure() {
    const h = $('#edHint');
    if (!h || !draft) return;
    if (draft.type === 'point') h.innerHTML = D.icon('mouse-pointer-2', 14) + ' Arrastra la marca en el mapa para moverla. Coordenadas: ' + esc(D.geo.fmtCoord(draft.coords));
    else {
      const m = draft.type === 'line' ? D.geo.fmtLen(D.geo.length(draft.coords)) : D.geo.fmtArea(D.geo.area(draft.coords)) + ' · perímetro ' + D.geo.fmtLen(D.geo.length(draft.coords, true));
      h.innerHTML = D.icon('ruler', 14) + ' <b>' + esc(m) + '</b> · Arrastra los vértices; los puntos pequeños añaden uno nuevo; doble clic en un vértice lo elimina.';
    }
  }
})();

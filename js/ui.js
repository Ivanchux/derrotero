/* Derrotero · interfaz: panel lateral, ficha de detalle, menús, componentes comunes */
(function () {
  'use strict';
  const D = window.Derrotero;
  const UI = (D.ui = {});
  const $ = D.$;
  const esc = D.esc;
  const isView = () => D.state.mode === 'view';
  const expanded = new Set();
  const typeIcon = { point: 'map-pin', line: 'spline', area: 'pentagon' };
  const typeName = { point: 'Punto', line: 'Línea', area: 'Área' };

  /* ======================== Componentes ======================== */
  UI.popover = (anchor, el, { width, align = 'left' } = {}) => {
    const pop = $('#popover');
    pop.innerHTML = '';
    pop.appendChild(el);
    pop.style.width = width ? width + 'px' : '';
    pop.classList.add('is-open');
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = align === 'right' ? r.right - pw : r.left;
    left = D.clamp(left, 10, window.innerWidth - pw - 10);
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    const off = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) UI.closePopover(); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); UI.closePopover(); } };
    UI._popOff = () => { document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', key, true); };
    setTimeout(() => { document.addEventListener('mousedown', off, true); document.addEventListener('keydown', key, true); });
  };
  UI.closePopover = () => {
    const pop = $('#popover');
    pop.classList.remove('is-open');
    if (UI._popOff) UI._popOff();
    UI._popOff = null;
  };

  UI.switchEl = (checked, onChange) => {
    const l = D.el(`<label class="switch"><input type="checkbox" ${checked ? 'checked' : ''}><span></span></label>`);
    $('input', l).addEventListener('change', (e) => onChange(e.target.checked));
    return l;
  };
  UI.seg = (options, value, onChange) => {
    const el = D.el(`<div class="seg" role="group">${options.map((o) => `<button type="button" data-v="${esc(o.v)}" class="${o.v === value ? 'is-active' : ''}" ${o.title ? `title="${esc(o.title)}"` : ''}>${o.icon ? D.icon(o.icon, 15) : ''}${o.label ? `<span>${esc(o.label)}</span>` : ''}</button>`).join('')}</div>`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      D.$$('button', el).forEach((x) => x.classList.toggle('is-active', x === b));
      onChange(b.dataset.v);
    });
    return el;
  };
  UI.colorField = (value, onChange) => {
    const el = D.el(`<div class="colors"></div>`);
    const paint = (v) => {
      el.innerHTML =
        D.PALETTE.map((c) => `<button type="button" class="colors__sw ${c.toLowerCase() === String(v).toLowerCase() ? 'is-active' : ''}" style="--c:${c}" data-c="${c}" aria-label="${c}"></button>`).join('') +
        `<label class="colors__custom ${D.PALETTE.some((c) => c.toLowerCase() === String(v).toLowerCase()) ? '' : 'is-active'}" title="Color personalizado" style="--c:${esc(v)}"><input type="color" value="${D.color.valid(v) && v.length === 7 ? v : '#C9A862'}"></label>`;
    };
    paint(value);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      value = b.dataset.c; paint(value); onChange(value);
    });
    el.addEventListener('input', (e) => {
      if (e.target.type !== 'color') return;
      value = e.target.value;
      el.querySelectorAll('.is-active').forEach((x) => x.classList.remove('is-active'));
      $('.colors__custom', el).classList.add('is-active');
      $('.colors__custom', el).style.setProperty('--c', value);
      onChange(value);
    });
    el.set = (v) => { value = v; paint(v); };
    return el;
  };
  UI.iconPicker = (anchor, current, onPick) => {
    const I = window.DerroteroIcons.pick;
    const el = D.el(`<div class="picker"><input type="text" class="picker__q" placeholder="Buscar icono…"><div class="picker__grid"></div></div>`);
    const grid = $('.picker__grid', el);
    const draw = (q) => {
      q = D.norm(q);
      grid.innerHTML = Object.keys(I)
        .filter((k) => !q || D.norm(I[k].l).includes(q) || k.includes(q))
        .map((k) => `<button type="button" class="picker__ic ${k === current ? 'is-active' : ''}" data-k="${k}" title="${esc(I[k].l)}">${D.icon(k, 20)}</button>`)
        .join('') || '<p class="muted small">Sin resultados</p>';
    };
    draw('');
    $('.picker__q', el).addEventListener('input', (e) => draw(e.target.value));
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      UI.closePopover();
      onPick(b.dataset.k);
    });
    UI.popover(anchor, el, { width: 300 });
    setTimeout(() => $('.picker__q', el).focus(), 30);
  };

  UI.menu = (x, y, entries) => {
    const m = $('#ctx');
    m.innerHTML = entries
      .map((e, i) => (e.sep ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${e.danger ? 'is-danger' : ''}">${e.icon ? D.icon(e.icon, 16) : ''}<span>${esc(e.label)}</span></button>`))
      .join('');
    m.classList.add('is-open');
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    m.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
    const close = () => { m.classList.remove('is-open'); document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', key, true); window.removeEventListener('blur', close); };
    const off = (e) => { if (!m.contains(e.target)) close(); };
    const key = (e) => { if (e.key === 'Escape') close(); };
    m.onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      close();
      entries[+b.dataset.i].fn();
    };
    document.addEventListener('mousedown', off, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('blur', close);
    D.map.map.once('movestart', close);
  };

  /* ======================== Lightbox ======================== */
  UI.lightbox = (images, index = 0) => {
    const lb = $('#lightbox');
    let i = index;
    const draw = () => {
      const im = images[i];
      lb.innerHTML = `<button class="lightbox__x icon-btn" aria-label="Cerrar">${D.icon('x', 22)}</button>
        ${images.length > 1 ? `<button class="lightbox__nav lightbox__nav--p icon-btn" aria-label="Anterior">${D.icon('chevron-left', 26)}</button><button class="lightbox__nav lightbox__nav--n icon-btn" aria-label="Siguiente">${D.icon('chevron-right', 26)}</button>` : ''}
        <figure><img src="${esc(im.src)}" alt="${esc(im.caption || '')}" referrerpolicy="no-referrer">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`;
    };
    const close = () => { lb.classList.remove('is-open'); document.removeEventListener('keydown', key, true); };
    const go = (d) => { i = (i + d + images.length) % images.length; draw(); };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight' && images.length > 1) { e.stopPropagation(); go(1); }
      else if (e.key === 'ArrowLeft' && images.length > 1) { e.stopPropagation(); go(-1); }
    };
    lb.onclick = (e) => {
      if (e.target.closest('.lightbox__nav--n')) return go(1);
      if (e.target.closest('.lightbox__nav--p')) return go(-1);
      if (e.target.tagName !== 'IMG' && e.target.tagName !== 'FIGCAPTION') close();
    };
    draw();
    lb.classList.add('is-open');
    document.addEventListener('keydown', key, true);
  };

  /* ======================== Galería (se usa en detalle y recorrido) ======================== */
  UI.galleryHTML = (images) => {
    if (!images.length) return '';
    return `<div class="gal" data-gal>
      <div class="gal__stage"><img class="gal__img" src="${esc(images[0].src)}" alt="${esc(images[0].caption || '')}" referrerpolicy="no-referrer" loading="lazy">
        ${images.length > 1 ? `<button class="gal__nav gal__nav--p" data-gal-go="-1" aria-label="Anterior">${D.icon('chevron-left', 20)}</button><button class="gal__nav gal__nav--n" data-gal-go="1" aria-label="Siguiente">${D.icon('chevron-right', 20)}</button><span class="gal__count">1 / ${images.length}</span>` : ''}
        <button class="gal__zoom" data-gal-zoom aria-label="Ampliar">${D.icon('maximize', 16)}</button>
      </div>
      <p class="gal__cap">${esc(images[0].caption || '')}</p>
      ${images.length > 1 ? `<div class="gal__thumbs">${images.map((im, k) => `<button class="gal__th ${k === 0 ? 'is-active' : ''}" data-gal-i="${k}"><img src="${esc(im.src)}" alt="" referrerpolicy="no-referrer" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>`;
  };
  UI.bindGallery = (root, images) => {
    const g = $('[data-gal]', root);
    if (!g) return;
    let i = 0;
    const img = $('.gal__img', g), cap = $('.gal__cap', g), cnt = $('.gal__count', g);
    const show = (k) => {
      i = (k + images.length) % images.length;
      img.classList.add('is-swap');
      setTimeout(() => {
        img.src = images[i].src; img.alt = images[i].caption || '';
        cap.textContent = images[i].caption || '';
        if (cnt) cnt.textContent = `${i + 1} / ${images.length}`;
        D.$$('.gal__th', g).forEach((t, n) => t.classList.toggle('is-active', n === i));
        img.classList.remove('is-swap');
      }, 140);
    };
    g.addEventListener('click', (e) => {
      const go = e.target.closest('[data-gal-go]');
      if (go) return show(i + +go.dataset.galGo);
      const th = e.target.closest('[data-gal-i]');
      if (th) return show(+th.dataset.galI);
      if (e.target.closest('[data-gal-zoom]') || e.target === img) UI.lightbox(images, i);
    });
  };

  /* ======================== Panel de detalle ======================== */
  UI.richHTML = (it) => (it.description ? `<div class="rich">${it.description}</div>` : '');
  UI.linksHTML = (it) =>
    it.links.length
      ? `<div class="links">${it.links.map((l) => `<a class="link-chip" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${D.icon('external-link', 15)}<span class="link-chip__t">${esc(l.label || D.domain(l.url))}</span><span class="link-chip__d">${esc(D.domain(l.url))}</span></a>`).join('')}</div>`
      : '';
  UI.tagsHTML = (it) => (it.tags.length ? `<div class="tags">${it.tags.map((t) => `<button class="tag ${D.state.tagFilter.has(t) ? 'is-on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : '');
  UI.measureHTML = (it) => {
    if (it.type === 'line') return `<span class="meta__chip">${D.icon('ruler', 14)}${D.geo.fmtLen(D.geo.length(it.coords))}</span>`;
    if (it.type === 'area') return `<span class="meta__chip">${D.icon('pentagon', 14)}${D.geo.fmtArea(D.geo.area(it.coords))}</span><span class="meta__chip">${D.icon('ruler', 14)}${D.geo.fmtLen(D.geo.length(it.coords, true))} de perímetro</span>`;
    return `<button class="meta__chip meta__chip--btn" data-copy="${esc(D.geo.fmtCoord(it.coords))}" title="Copiar coordenadas">${D.icon('copy', 14)}${esc(D.geo.fmtCoord(it.coords))}</button>`;
  };

  function detailHTML(it) {
    const c = D.catById(it.categoryId) || { name: '—', color: '#C9A862' };
    const st = D.styleOf(it);
    const inTour = D.state.project.tour.steps.some((s) => s.itemId === it.id);
    return `<div class="detail__bar">
        <span class="chip-cat" style="--c:${st.color}"><i></i>${esc(c.name)}</span>
        <span class="grow"></span>
        <button class="icon-btn" data-act="center" title="Centrar en el mapa">${D.icon('crosshair')}</button>
        <button class="icon-btn" data-edit data-act="tour" title="${inTour ? 'Quitar del recorrido' : 'Añadir al recorrido'}">${D.icon('route')}${inTour ? '<b class="dot-on"></b>' : ''}</button>
        <button class="icon-btn" data-edit data-act="edit" title="Editar (E)">${D.icon('pencil')}</button>
        <button class="icon-btn icon-btn--danger" data-edit data-act="delete" title="Eliminar">${D.icon('trash-2')}</button>
        <button class="icon-btn" data-act="close" title="Cerrar (Esc)">${D.icon('x')}</button>
      </div>
      <div class="detail__scroll">
        <div class="stag" style="--i:0">${UI.galleryHTML(it.images)}</div>
        <div class="detail__head stag" style="--i:1">
          <h2 class="detail__title">${esc(it.title)}</h2>
          <div class="meta">${D.icon(typeIcon[it.type], 14)}<span>${typeName[it.type]}</span>${UI.measureHTML(it)}</div>
        </div>
        <div class="stag" style="--i:2">${UI.richHTML(it)}</div>
        <div class="stag" style="--i:3">${UI.linksHTML(it)}</div>
        <div class="stag" style="--i:4">${UI.tagsHTML(it)}</div>
      </div>`;
  }

  UI.openDetail = (id) => {
    const it = D.itemById(id);
    const panel = $('#detail');
    if (!it) return UI.closeDetail();
    if (D.state.editing || D.state.touring) return;
    panel.classList.remove('is-editing');
    panel.innerHTML = detailHTML(it);
    panel.classList.add('is-open');
    panel.scrollTop = 0;
    UI.bindGallery(panel, it.images);
  };
  UI.closeDetail = () => {
    const panel = $('#detail');
    panel.classList.remove('is-open', 'is-editing');
    setTimeout(() => { if (!panel.classList.contains('is-open')) panel.innerHTML = ''; }, 420);
  };
  function bindDetail() {
    const panel = $('#detail');
    panel.addEventListener('click', async (e) => {
      const it = D.itemById(D.state.selectedId);
      const copy = e.target.closest('[data-copy]');
      if (copy) { if (await D.copy(copy.dataset.copy)) D.toast('Coordenadas copiadas'); return; }
      const tag = e.target.closest('[data-tag]');
      if (tag) { UI.toggleTag(tag.dataset.tag); return; }
      const a = e.target.closest('[data-act]');
      if (!a || !it) return;
      const act = a.dataset.act;
      if (act === 'close') D.map.select(null);
      else if (act === 'center') D.map.flyToItem(it, { duration: 1.2, minZoom: 15 });
      else if (act === 'edit') D.editor.open(it.id);
      else if (act === 'delete') D.store.removeItem(it.id);
      else if (act === 'tour') UI.toggleInTour(it.id);
    });
  }
  UI.toggleInTour = (id) => {
    const steps = D.state.project.tour.steps.slice();
    const i = steps.findIndex((s) => s.itemId === id);
    if (i >= 0) steps.splice(i, 1); else steps.push({ itemId: id, zoom: null });
    D.store.setSteps(steps);
    D.toast(i >= 0 ? 'Quitado del recorrido' : 'Añadido al recorrido (paso ' + steps.length + ')');
    if (D.state.selectedId === id) UI.openDetail(id);
  };

  /* ======================== Etiquetas ======================== */
  UI.toggleTag = (t) => {
    const f = D.state.tagFilter;
    if (f.has(t)) f.delete(t); else f.add(t);
    D.emit('filters');
    renderLayers();
    if (D.state.selectedId && !D.state.editing) UI.openDetail(D.state.selectedId);
  };

  /* ======================== Pestaña Capas ======================== */
  function renderLayers() {
    const p = D.state.project;
    const root = $('#tab-layers');
    const sc = root.scrollTop;
    const tf = D.state.tagFilter;
    const tags = D.allTags();
    const edit = !isView();
    let html = `<div class="sec"><div class="sec__head"><h3>Categorías</h3><div class="sec__tools">
        <button class="icon-btn icon-btn--sm" data-act="all-on" title="Mostrar todas">${D.icon('eye', 16)}</button>
        <button class="icon-btn icon-btn--sm" data-act="all-off" title="Ocultar todas">${D.icon('eye-off', 16)}</button>
        ${edit ? `<button class="icon-btn icon-btn--sm" data-act="add-cat" title="Nueva categoría">${D.icon('plus', 16)}</button>` : ''}</div></div><ul class="cats">`;
    p.categories.forEach((c) => {
      const its = p.items.filter((i) => i.categoryId === c.id);
      const open = expanded.has(c.id);
      html += `<li class="cat ${c.visible ? '' : 'is-off'} ${open ? 'is-open' : ''}" data-cat="${c.id}" style="--c:${esc(c.color)}">
        <div class="cat__row">
          <button class="cat__eye" data-act="toggle" aria-pressed="${c.visible}" title="${c.visible ? 'Ocultar esta capa' : 'Mostrar esta capa'}"><span class="sw"></span></button>
          <button class="cat__name" data-act="expand"><span>${esc(c.name)}</span><em>${its.length}</em></button>
          <button class="icon-btn icon-btn--sm cat__act" data-act="solo" title="Mostrar solo esta capa">${D.icon('target', 15)}</button>
          ${edit ? `<button class="icon-btn icon-btn--sm cat__act" data-act="edit-cat" title="Editar categoría">${D.icon('pencil', 15)}</button>` : ''}
          <button class="icon-btn icon-btn--sm cat__chev" data-act="expand" tabindex="-1">${D.icon('chevron-down', 16)}</button>
        </div>
        <div class="items"><ul class="items__in">${
          its.length
            ? its.map((i) => {
                const st = D.styleOf(i);
                const dim = tf.size && !i.tags.some((t) => tf.has(t));
                return `<li><button class="itm ${i.id === D.state.selectedId ? 'is-active' : ''} ${dim ? 'is-dim' : ''}" data-item="${i.id}"><span class="itm__ic" style="color:${esc(st.color)}">${D.icon(i.type === 'point' ? st.icon : typeIcon[i.type], 16)}</span><span class="itm__t">${esc(i.title)}</span></button></li>`;
              }).join('')
            : '<li class="muted small pad">Sin elementos todavía</li>'
        }</ul></div></li>`;
    });
    html += '</ul></div>';
    if (tags.length)
      html += `<div class="sec"><div class="sec__head"><h3>Etiquetas</h3>${tf.size ? '<button class="link-btn" data-act="clear-tags">Limpiar filtro</button>' : ''}</div><div class="tags tags--cloud">${tags.map(([t, n]) => `<button class="tag ${tf.has(t) ? 'is-on' : ''}" data-tag="${esc(t)}">#${esc(t)} <em>${n}</em></button>`).join('')}</div></div>`;
    if (!p.items.length)
      html += `<div class="empty"><div class="empty__ic">${D.icon('map-pin-plus', 28)}</div><h4>El mapa está vacío</h4><p>Usa las herramientas de la parte inferior para colocar un punto, trazar una línea o dibujar un área. También puedes importar un GeoJSON desde la pestaña «Mapa».</p></div>`;
    root.innerHTML = html;
    root.scrollTop = sc;
  }
  function bindLayers() {
    const root = $('#tab-layers');
    root.addEventListener('click', (e) => {
      const tag = e.target.closest('[data-tag]');
      if (tag) return UI.toggleTag(tag.dataset.tag);
      const itm = e.target.closest('[data-item]');
      if (itm) return UI.focusItem(itm.dataset.item);
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const li = b.closest('[data-cat]');
      const id = li && li.dataset.cat;
      const act = b.dataset.act;
      if (act === 'toggle') D.store.setVisible(id, !D.catById(id).visible);
      else if (act === 'solo') {
        const only = D.state.project.categories.every((c) => c.visible === (c.id === id));
        if (only) D.store.setAllVisible(true); else D.store.isolate(id);
      } else if (act === 'expand') {
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        li.classList.toggle('is-open', expanded.has(id));
      } else if (act === 'edit-cat') UI.categoryDialog(D.catById(id));
      else if (act === 'add-cat') UI.categoryDialog(null);
      else if (act === 'all-on') D.store.setAllVisible(true);
      else if (act === 'all-off') D.store.setAllVisible(false);
      else if (act === 'clear-tags') { D.state.tagFilter.clear(); D.emit('filters'); renderLayers(); }
    });
  }
  UI.focusItem = (id, opts = {}) => {
    const it = D.itemById(id);
    if (!it) return;
    const c = D.catById(it.categoryId);
    if (c && !c.visible) D.store.setVisible(c.id, true);
    expanded.add(it.categoryId);
    D.map.select(id);
    D.map.flyToItem(it, { duration: opts.duration || 1.6, minZoom: 15 });
  };

  /* ======================== Categorías (diálogo) ======================== */
  UI.categoryDialog = (cat) => {
    const isNew = !cat;
    const draft = cat ? { name: cat.name, color: cat.color, icon: cat.icon } : { name: '', color: D.PALETTE[D.state.project.categories.length % D.PALETTE.length], icon: 'map-pin' };
    const body = D.el(`<div class="form">
      <label class="field"><span>Nombre</span><input type="text" id="catName" maxlength="60" placeholder="Por ejemplo: Competencia directa" value="${esc(draft.name)}"></label>
      <div class="field"><span>Color de la capa</span><div id="catColor"></div></div>
      <div class="field"><span>Icono por defecto</span><button type="button" class="btn btn--icon" id="catIcon">${D.icon(draft.icon, 18)}<span>Cambiar icono</span></button></div>
      ${!isNew && D.state.project.categories.length > 1 ? `<div class="field"><span>Si la eliminas, sus elementos pasan a</span><select id="catMove">${D.state.project.categories.filter((c) => c.id !== cat.id).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>` : ''}
    </div>`);
    $('#catColor', body).appendChild(UI.colorField(draft.color, (v) => (draft.color = v)));
    $('#catIcon', body).onclick = (e) => UI.iconPicker(e.currentTarget, draft.icon, (k) => { draft.icon = k; e.currentTarget.innerHTML = D.icon(k, 18) + '<span>Cambiar icono</span>'; });
    const actions = [];
    if (!isNew && D.state.project.categories.length > 1)
      actions.push({ label: 'Eliminar', kind: 'danger', onClick: () => { D.store.removeCategory(cat.id, $('#catMove', body).value); } });
    actions.push({ label: 'Cancelar' });
    actions.push({
      label: isNew ? 'Crear categoría' : 'Guardar', kind: 'primary',
      onClick: () => {
        const name = $('#catName', body).value.trim() || 'Categoría';
        if (isNew) D.store.addCategory({ name, color: draft.color, icon: draft.icon });
        else D.store.updateCategory(cat.id, { name, color: draft.color, icon: draft.icon });
      },
    });
    const m = D.modal({ title: isNew ? 'Nueva categoría' : 'Editar categoría', body, actions, size: 'sm' });
    $('#catName', body).addEventListener('keydown', (e) => { if (e.key === 'Enter') D.$$('.modal__foot .btn--primary', m.el)[0].click(); });
  };

  /* ======================== Pestaña Mapa (ajustes y datos) ======================== */
  function renderData() {
    const p = D.state.project;
    const root = $('#tab-data');
    const s = p.settings;
    root.innerHTML = `
      <div class="sec"><div class="sec__head"><h3>Portada del mapa</h3></div>
        <label class="field"><span>Título</span><input id="metaTitle" maxlength="120" value="${esc(p.meta.title)}"></label>
        <label class="field"><span>Subtítulo</span><input id="metaSub" maxlength="200" value="${esc(p.meta.subtitle)}"></label>
        <label class="field"><span>Autor</span><input id="metaAuthor" maxlength="100" value="${esc(p.meta.author)}"></label>
        <label class="field"><span>Descripción</span><textarea id="metaDesc" rows="4" maxlength="1200">${esc(p.meta.description)}</textarea></label>
        <p class="hint">Estos textos aparecen en la primera diapositiva del recorrido y en el HTML incrustable.</p>
      </div>
      <div class="sec"><div class="sec__head"><h3>Vista del mapa</h3></div>
        <div class="field"><span>Mapa base</span><div id="setBase"></div></div>
        <div class="row"><div><b>Agrupar marcas cercanas</b><small>Útil cuando hay muchas</small></div><div id="setCluster"></div></div>
        <label class="field field--range ${s.cluster ? '' : 'is-disabled'}" id="radiusField"><span>Radio de agrupación <em id="radiusVal">${s.clusterRadius} px</em></span><input type="range" id="setRadius" min="30" max="120" step="5" value="${s.clusterRadius}"></label>
        <div class="row"><div><b>Mostrar nombres junto a las marcas</b><small>Etiquetas permanentes</small></div><div id="setLabels"></div></div>
      </div>
      <div class="sec"><div class="sec__head"><h3>Importar y exportar</h3></div>
        <div class="grid2">
          <button class="tile-btn" data-act="import">${D.icon('file-up', 20)}<b>Importar</b><small>GeoJSON o JSON</small></button>
          <button class="tile-btn" data-act="export-json">${D.icon('file-json', 20)}<b>Copia completa</b><small>JSON de Derrotero</small></button>
          <button class="tile-btn" data-act="export-geojson">${D.icon('map', 20)}<b>GeoJSON</b><small>Para otras herramientas</small></button>
          <button class="tile-btn tile-btn--brass" data-act="export-embed">${D.icon('code-xml', 20)}<b>HTML incrustable</b><small>Un solo archivo</small></button>
        </div>
      </div>
      <div class="sec"><div class="sec__head"><h3>Mapas guardados</h3></div>
        <div class="grid2">
          <button class="btn btn--block" data-act="new-map">${D.icon('plus', 16)}Nuevo mapa vacío</button>
          <button class="btn btn--block" data-act="load-demo">${D.icon('map', 16)}Cargar el ejemplo</button>
          <button class="btn btn--block" data-act="dup-map">${D.icon('copy-plus', 16)}Duplicar este mapa</button>
          <button class="btn btn--block btn--danger-ghost" data-act="clear-map">${D.icon('trash-2', 16)}Vaciar el mapa</button>
        </div>
        <p class="hint" id="storageHint"></p>
      </div>`;
    $('#setBase', root).appendChild(UI.seg(D.BASES.map((b) => ({ v: b, label: { night: 'Noche', osm: 'Estándar', topo: 'Relieve' }[b] })), p.view.base, (v) => D.store.setBase(v)));
    $('#setCluster', root).appendChild(UI.switchEl(s.cluster, (v) => { D.store.setSettings({ cluster: v }); $('#radiusField', root).classList.toggle('is-disabled', !v); }));
    $('#setLabels', root).appendChild(UI.switchEl(s.labels, (v) => D.store.setSettings({ labels: v })));
    $('#setRadius', root).addEventListener('input', (e) => { $('#radiusVal', root).textContent = e.target.value + ' px'; });
    $('#setRadius', root).addEventListener('change', (e) => D.store.setSettings({ clusterRadius: +e.target.value }));
    const meta = D.debounce(() => D.store.setMeta({ title: $('#metaTitle', root).value.trim() || 'Mapa sin título', subtitle: $('#metaSub', root).value.trim(), author: $('#metaAuthor', root).value.trim(), description: $('#metaDesc', root).value.trim() }), 350);
    ['#metaTitle', '#metaSub', '#metaAuthor', '#metaDesc'].forEach((s2) => $(s2, root).addEventListener('input', meta));
    $('#storageHint', root).textContent = D.store.adapterKind === 'memoria' ? 'Este navegador no deja guardar datos: exporta tu mapa para conservarlo.' : 'Se guarda solo en este navegador (' + D.store.adapterKind + '). Exporta una copia de vez en cuando.';
  }
  function bindData() {
    $('#tab-data').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'import') $('#fileImport').click();
      else if (a === 'export-json') D.io.exportJSON();
      else if (a === 'export-geojson') D.io.exportGeoJSON();
      else if (a === 'export-embed') D.io.embedDialog();
      else if (a === 'new-map') { await D.store.create(D.newProject()); D.toast('Mapa nuevo creado'); }
      else if (a === 'load-demo') { await D.store.create(D.buildDemo()); D.toast('Ejemplo cargado como mapa nuevo'); }
      else if (a === 'dup-map') D.store.duplicate();
      else if (a === 'clear-map') { if (await D.confirm({ title: 'Vaciar el mapa', text: 'Se eliminarán todos los puntos, líneas y áreas, y el recorrido. Las categorías se conservan.', ok: 'Vaciar', danger: true })) D.store.clearAll(); }
    });
  }

  /* ======================== Cabecera y estado de guardado ======================== */
  function renderHead() {
    const p = D.state.project;
    $('#projTitle').textContent = p.meta.title;
    $('#projSub').textContent = p.meta.subtitle || `${p.items.length} elemento${p.items.length === 1 ? '' : 's'} · ${p.categories.length} categoría${p.categories.length === 1 ? '' : 's'}`;
    document.title = p.meta.title + ' · Derrotero';
  }
  function bindSaveStatus() {
    const el = $('#saveStatus');
    D.on('save-status', (s) => {
      if (s.pending) { el.className = 'save-status is-pending'; el.innerHTML = '<i></i>Guardando…'; }
      else if (s.ok) { el.className = 'save-status is-ok'; el.innerHTML = `<i></i>Guardado automático · ${D.fmtTime(s.at || Date.now())}`; }
      else { el.className = 'save-status is-err'; el.innerHTML = '<i></i>No se pudo guardar (¿almacenamiento lleno?). Exporta una copia.'; }
    });
  }
  function bindProjectMenu() {
    $('#projectBtn').addEventListener('click', async (e) => {
      if (isView()) return;
      const list = await D.store.list();
      const el = D.el(`<div class="pmenu"><p class="pmenu__h">Mis mapas</p><div class="pmenu__list">${list.map((m) => `<button class="pmenu__it ${m.id === D.state.project.id ? 'is-active' : ''}" data-id="${m.id}"><span class="pmenu__t">${esc(m.title)}</span><span class="pmenu__s">${m.count} elem. · ${D.fmtDate(m.updated)}</span></button>`).join('')}</div>
        <div class="pmenu__foot"><button class="btn btn--sm" data-act="new">${D.icon('plus', 15)}Nuevo</button><button class="btn btn--sm btn--danger-ghost" data-act="del">${D.icon('trash-2', 15)}Eliminar este</button></div></div>`);
      el.addEventListener('click', async (ev) => {
        const it = ev.target.closest('[data-id]');
        const ac = ev.target.closest('[data-act]');
        UI.closePopover();
        if (it) { if (it.dataset.id !== D.state.project.id) await D.store.open(it.dataset.id); }
        else if (ac && ac.dataset.act === 'new') { await D.store.create(D.newProject()); D.toast('Mapa nuevo creado'); }
        else if (ac && ac.dataset.act === 'del') {
          if (await D.confirm({ title: 'Eliminar este mapa', text: `«${D.state.project.meta.title}» se borrará de este navegador. Si no tienes una copia exportada, no se podrá recuperar.`, ok: 'Eliminar', danger: true })) D.store.remove(D.state.project.id);
        }
      });
      UI.popover(e.currentTarget, el, { width: 320 });
    });
  }

  /* ======================== Tabs y barra lateral ======================== */
  UI.setTab = (name) => {
    D.$$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
    D.$$('.tab-view').forEach((v) => v.classList.toggle('is-active', v.id === 'tab-' + name));
    moveBar();
  };
  function moveBar() {
    const a = $('.tab.is-active');
    const bar = $('#tabsBar');
    if (!a || !bar) return;
    bar.style.width = a.offsetWidth + 'px';
    bar.style.transform = `translateX(${a.offsetLeft}px)`;
  }
  function bindSidebar() {
    $('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) UI.setTab(t.dataset.tab); });
    const sb = $('#sidebar');
    const set = (open) => {
      sb.classList.toggle('is-collapsed', !open);
      document.body.classList.toggle('sb-closed', !open);
      setTimeout(moveBar, 480);
    };
    UI.sidebar = set;
    $('#btnCollapse').onclick = () => set(false);
    $('#btnExpand').onclick = () => set(true);
    if (window.innerWidth < 900 || (isView() && D.state.viewOptions.panel === false)) set(false);
    window.addEventListener('resize', moveBar);
    setTimeout(moveBar, 60);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveBar);
  }

  /* ======================== Dock y base ======================== */
  function bindDock() {
    $('#dock').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tool]');
      if (b) D.tools.set(D.state.tool === b.dataset.tool && b.dataset.tool !== 'select' ? 'select' : b.dataset.tool);
    });
    D.on('tool', (t) => D.$$('#dock [data-tool]').forEach((b) => b.classList.toggle('is-active', b.dataset.tool === t)));
    ['#btnFit', '#btnFit2'].forEach((s) => ($(s).onclick = () => D.map.fitAll()));
    ['#btnPresent', '#btnPresent2'].forEach((s) => ($(s).onclick = () => D.tour.start()));
  }
  function renderBase() {
    const sw = $('#baseSwitch');
    const cur = D.state.project.view.base;
    sw.innerHTML = D.BASES.map((b) => `<button data-b="${b}" class="${b === cur ? 'is-active' : ''}">${{ night: 'Noche', osm: 'Estándar', topo: 'Relieve' }[b]}</button>`).join('');
  }
  function bindBase() {
    $('#baseSwitch').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) D.store.setBase(b.dataset.b); });
    D.on('settings', (k) => { if (k && k.includes('base')) { renderBase(); const s = $('#setBase'); if (s) D.$$('button', s).forEach((x) => x.classList.toggle('is-active', x.dataset.v === D.state.project.view.base)); } });
  }

  /* ======================== Menús contextuales ======================== */
  function bindContext() {
    D.on('map-context', (e) => {
      if (isView() || D.state.editing) return;
      const ll = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)];
      UI.menu(e.originalEvent.clientX, e.originalEvent.clientY, [
        { label: 'Añadir punto aquí', icon: 'map-pin-plus', fn: () => D.emit('draw-complete', { type: 'point', coords: ll }) },
        { label: 'Centrar aquí', icon: 'crosshair', fn: () => D.map.map.panTo(e.latlng) },
        { label: 'Copiar coordenadas', icon: 'copy', fn: async () => { if (await D.copy(D.geo.fmtCoord(ll))) D.toast('Coordenadas copiadas'); } },
      ]);
    });
    D.on('item-context', ({ id, e }) => {
      if (isView() || D.state.editing) return;
      const it = D.itemById(id);
      const inTour = D.state.project.tour.steps.some((s) => s.itemId === id);
      UI.menu(e.originalEvent.clientX, e.originalEvent.clientY, [
        { label: 'Editar', icon: 'pencil', fn: () => { D.map.select(id); D.editor.open(id); } },
        { label: 'Centrar', icon: 'crosshair', fn: () => D.map.flyToItem(it, { duration: 1.2, minZoom: 15 }) },
        { label: inTour ? 'Quitar del recorrido' : 'Añadir al recorrido', icon: 'route', fn: () => UI.toggleInTour(id) },
        { sep: true },
        { label: 'Eliminar', icon: 'trash-2', danger: true, fn: () => D.store.removeItem(id) },
      ]);
    });
  }

  /* ======================== Atajos de teclado ======================== */
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if ($('#modals').children.length || $('#lightbox').classList.contains('is-open')) return;
      if (document.body.classList.contains('is-tour')) return;
      const k = e.key.toLowerCase();
      if (k === '/') { e.preventDefault(); $('#searchInput').focus(); }
      else if (k === 'f') D.map.fitAll();
      else if (k === 't') D.tour.start();
      else if (k === 'escape') { if (D.state.selectedId && !D.state.editing) D.map.select(null); }
      else if (!isView() && !D.state.editing) {
        if (k === 'v') D.tools.set('select');
        else if (k === 'p') D.tools.set('point');
        else if (k === 'l') D.tools.set('line');
        else if (k === 'a') D.tools.set('area');
        else if (k === 'e' && D.state.selectedId) D.editor.open(D.state.selectedId);
        else if ((k === 'delete' || k === 'backspace') && D.state.selectedId) { e.preventDefault(); D.store.removeItem(D.state.selectedId); }
      }
    });
  }

  /* ======================== Inicio ======================== */
  UI.renderAll = () => { renderHead(); renderLayers(); if (!isView()) renderData(); renderBase(); };
  UI.init = () => {
    const stageEl = $('.stage'), detailEl = $('#detail');
    new MutationObserver(() => stageEl.classList.toggle('has-panel', detailEl.classList.contains('is-open')))
      .observe(detailEl, { attributes: true, attributeFilter: ['class'] });
    D.hydrateIcons();
    $('#verLabel').textContent = 'v' + D.VERSION;
    document.body.classList.add(isView() ? 'mode-view' : 'mode-edit');
    $('#dock').hidden = isView();
    $('#dockView').hidden = !isView();
    bindSidebar(); bindLayers(); bindDetail(); bindSaveStatus(); bindDock(); bindBase(); bindContext(); bindKeys();
    if (!isView()) { bindData(); bindProjectMenu(); }
    UI.renderAll();
    D.on('project', () => { expanded.clear(); UI.closeDetail(); UI.renderAll(); });
    D.on('items', () => { renderHead(); renderLayers(); if (D.state.selectedId && !D.state.editing) { if (D.itemById(D.state.selectedId)) UI.openDetail(D.state.selectedId); else UI.closeDetail(); } });
    D.on('categories', () => { renderHead(); renderLayers(); if (D.state.selectedId && !D.state.editing) UI.openDetail(D.state.selectedId); });
    D.on('meta', renderHead);
    D.on('tour', () => { if (D.state.selectedId && !D.state.editing && D.itemById(D.state.selectedId)) UI.openDetail(D.state.selectedId); });
    D.on('selection', ({ id }) => {
      if (id) {
        const it = D.itemById(id);
        if (it && !expanded.has(it.categoryId)) { expanded.add(it.categoryId); renderLayers(); }
        UI.openDetail(id);
      } else if (!D.state.editing) UI.closeDetail();
      D.$$('.itm').forEach((b) => b.classList.toggle('is-active', b.dataset.item === id));
      const act = $('.itm.is-active');
      if (act) act.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    if (D.state.mode === 'edit') { const st = D.state.savedAt || D.state.project.meta.updated; D.emit('save-status', { ok: true, at: st }); }
  };
})();

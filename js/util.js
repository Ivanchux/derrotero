/* Derrotero · utilidades comunes (sin dependencias). Scripts clásicos: funciona abriendo index.html con file:// */
(function () {
  'use strict';
  const D = (window.Derrotero = window.Derrotero || {});
  D.VERSION = '0.1.0';
  D.NAME = 'Derrotero';

  /* ---------- DOM ---------- */
  D.$ = (s, r = document) => r.querySelector(s);
  D.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  D.el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  };
  D.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  D.uid = (p = 'i') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  D.debounce = (fn, ms) => {
    let t;
    const f = (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
    f.flush = (...a) => {
      clearTimeout(t);
      fn(...a);
    };
    f.cancel = () => clearTimeout(t);
    return f;
  };
  D.clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  D.norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  /* ---------- Eventos ---------- */
  const handlers = {};
  D.on = (evt, fn) => {
    (handlers[evt] = handlers[evt] || []).push(fn);
    return () => (handlers[evt] = handlers[evt].filter((f) => f !== fn));
  };
  D.emit = (evt, data) => (handlers[evt] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error('[Derrotero] error en', evt, e); } });

  /* ---------- Iconos ---------- */
  D.icon = (name, size = 18, cls = '') => {
    const I = window.DerroteroIcons || { ui: {}, pick: {} };
    const inner = I.ui[name] || (I.pick[name] && I.pick[name].s) || '';
    return `<svg class="i ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  };
  D.hydrateIcons = (root = document) => {
    D.$$('[data-i]', root).forEach((n) => {
      const sz = +n.getAttribute('data-s') || 18;
      n.insertAdjacentHTML('afterbegin', D.icon(n.getAttribute('data-i'), sz));
      n.removeAttribute('data-i');
    });
  };

  /* ---------- Color ---------- */
  D.color = {
    lum(hex) {
      const h = hex.replace('#', '');
      const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.substr(i, 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    readable(hex) {
      try { return D.color.lum(hex) > 0.38 ? '#0A1424' : '#F2EDE0'; } catch (e) { return '#0A1424'; }
    },
    valid: (h) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(h || '')),
  };
  D.PALETTE = ['#C9A862', '#E0604F', '#E8955A', '#E7C55B', '#8FCB6B', '#5FBFA4', '#5AB0D8', '#6F8FE8', '#A98BD6', '#D87BB2', '#F2EDE0', '#8A97B0'];

  /* ---------- Saneado de HTML (descripciones) ---------- */
  const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE', 'A', 'HR', 'CODE', 'DIV', 'SPAN']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'BASE']);
  D.sanitize = (html) => {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html || '') + '</body>', 'text/html');
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) { ch.remove(); return; }
        const tag = ch.tagName;
        if (DROP.has(tag)) { ch.remove(); return; }
        if (!ALLOWED.has(tag)) {
          walk(ch);
          while (ch.firstChild) node.insertBefore(ch.firstChild, ch);
          ch.remove();
          return;
        }
        Array.from(ch.attributes).forEach((a) => { if (!(tag === 'A' && a.name === 'href')) ch.removeAttribute(a.name); });
        if (tag === 'A') {
          const h = (ch.getAttribute('href') || '').trim();
          if (/^(https?:|mailto:)/i.test(h)) { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
          else ch.removeAttribute('href');
        }
        walk(ch);
      });
    };
    walk(doc.body);
    return doc.body.innerHTML;
  };
  D.htmlToText = (html) => {
    const d = document.createElement('div');
    d.innerHTML = D.sanitize(html);
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  };
  D.textToHtml = (txt) =>
    String(txt || '')
      .split(/\n{2,}/)
      .map((p) => '<p>' + D.esc(p).replace(/\n/g, '<br>') + '</p>')
      .join('');

  /* ---------- URLs ---------- */
  D.safeUrl = (u) => {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
    if (/^[\w-]+(\.[\w-]+)+(\/|$|\?|#)/.test(u)) return 'https://' + u;
    return '';
  };
  D.safeImg = (u) => {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml|avif);/i.test(u)) return u;
    return '';
  };
  D.domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

  /* ---------- Geometría ---------- */
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  D.geo = {
    dist(a, b) {
      const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    },
    length(pts, closed) {
      let t = 0;
      for (let i = 1; i < pts.length; i++) t += D.geo.dist(pts[i - 1], pts[i]);
      if (closed && pts.length > 2) t += D.geo.dist(pts[pts.length - 1], pts[0]);
      return t;
    },
    area(pts) {
      const n = pts.length;
      if (n < 3) return 0;
      let total = 0;
      for (let i = 0; i < n; i++) {
        const p1 = pts[i], p2 = pts[(i + 1) % n];
        total += rad(p2[1] - p1[1]) * (2 + Math.sin(rad(p1[0])) + Math.sin(rad(p2[0])));
      }
      return Math.abs((total * R * R) / 2);
    },
    centroid(pts) {
      const n = pts.length || 1;
      return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
    },
    fmtLen(m) {
      if (m < 1000) return Math.round(m).toLocaleString('es-ES') + ' m';
      return (m / 1000).toLocaleString('es-ES', { maximumFractionDigits: m < 10000 ? 2 : 1 }) + ' km';
    },
    fmtArea(m2) {
      if (m2 < 10000) return Math.round(m2).toLocaleString('es-ES') + ' m²';
      if (m2 < 1e6) return (m2 / 10000).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' ha';
      return (m2 / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' km²';
    },
    fmtCoord: (ll) => ll[0].toFixed(5) + ', ' + ll[1].toFixed(5),
  };

  /* ---------- Imágenes: subida → redimensionado → data URL ---------- */
  D.readAsDataURL = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  D.fileToImage = async (file, max = 1280) => {
    if (!/^image\//.test(file.type)) throw new Error('No es una imagen');
    if (file.type === 'image/svg+xml') return D.readAsDataURL(file);
    if (file.type === 'image/gif' && file.size < 1.5e6) return D.readAsDataURL(file);
    let bmp;
    try { bmp = await createImageBitmap(file); }
    catch (e) {
      const url = URL.createObjectURL(file);
      bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      URL.revokeObjectURL(url);
    }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/webp', 0.84);
    return out.startsWith('data:image/webp') ? out : c.toDataURL('image/jpeg', 0.85);
  };

  /* ---------- Descargas y portapapeles ---------- */
  D.download = (name, text, mime = 'application/json') => {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  D.slug = (s) => D.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'mapa';
  D.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const t = document.createElement('textarea');
      t.value = text; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { /* nada */ }
      t.remove();
      return ok;
    }
  };
  D.fmtTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  D.fmtDate = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  /* Nombre de la aplicación: cámbialo aquí y en los elementos con data-app-name de index.html */
  D.APP_NAME = 'Derrotero';

  /* ---------- Toasts ---------- */
  D.toast = (msg, opts = {}) => {
    const host = D.$('#toasts');
    if (!host) return;
    const t = D.el(`<div class="toast ${opts.kind ? 'toast--' + opts.kind : ''}"><span class="toast__msg"></span></div>`);
    D.$('.toast__msg', t).textContent = msg;
    if (opts.action) {
      const b = D.el(`<button class="toast__act">${D.esc(opts.action.label)}</button>`);
      b.onclick = () => { opts.action.fn(); close(); };
      t.appendChild(b);
    }
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    let timer = setTimeout(close, opts.ms || (opts.action ? 7000 : 3200));
    function close() {
      clearTimeout(timer);
      t.classList.remove('in');
      setTimeout(() => t.remove(), 350);
    }
    t.addEventListener('mouseenter', () => clearTimeout(timer));
    t.addEventListener('mouseleave', () => (timer = setTimeout(close, 1800)));
    return close;
  };

  /* ---------- Modal ---------- */
  D.modal = ({ title, body, actions = [], size = 'md', onClose, cls = '' }) => {
    const host = D.$('#modals');
    const m = D.el(`<div class="modal"><div class="modal__card modal__card--${size} ${cls}" role="dialog" aria-modal="true">
      <header class="modal__head"><h2 class="modal__title"></h2><button class="icon-btn" data-close aria-label="Cerrar">${D.icon('x', 18)}</button></header>
      <div class="modal__body"></div><footer class="modal__foot"></footer></div></div>`);
    D.$('.modal__title', m).textContent = title || '';
    const bodyEl = D.$('.modal__body', m);
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const foot = D.$('.modal__foot', m);
    if (!actions.length) foot.remove();
    const api = { el: m, body: bodyEl, close };
    actions.forEach((a) => {
      const b = D.el(`<button class="btn ${a.kind ? 'btn--' + a.kind : ''}">${D.esc(a.label)}</button>`);
      b.onclick = async () => { const r = a.onClick ? await a.onClick(api) : undefined; if (r !== false && !a.keep) close(); };
      foot.appendChild(b);
    });
    function close() {
      document.removeEventListener('keydown', onKey, true);
      m.classList.remove('in');
      setTimeout(() => m.remove(), 280);
      if (onClose) onClose();
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });
    D.$('[data-close]', m).onclick = close;
    document.addEventListener('keydown', onKey, true);
    host.appendChild(m);
    requestAnimationFrame(() => m.classList.add('in'));
    setTimeout(() => { const f = D.$('input,textarea,select,.btn--primary', m); if (f && !f.closest('.modal__head')) f.focus(); }, 80);
    return api;
  };
  D.confirm = ({ title, text, ok = 'Aceptar', danger = false }) =>
    new Promise((res) => {
      let done = false;
      const m = D.modal({
        title, size: 'sm', body: `<p class="muted">${D.esc(text)}</p>`,
        actions: [
          { label: 'Cancelar', onClick: () => { done = true; res(false); } },
          { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => { done = true; res(true); } },
        ],
        onClose: () => { if (!done) res(false); },
      });
      return m;
    });
})();

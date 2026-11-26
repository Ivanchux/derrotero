/* Derrotero · arranque */
(function () {
  'use strict';
  const D = window.Derrotero;
  async function boot() {
    try {
      await D.store.init();
      D.map.init(document.getElementById('map'));
      D.tools.init();
      D.ui.init();
      D.search.init();
      D.tour.init();
      D.io.init();
      document.querySelectorAll('[data-app-name]').forEach((e) => { e.textContent = D.APP_NAME; });
      document.title = D.APP_NAME + ' · mapas interactivos';
      const label = (root) => root.querySelectorAll && root.querySelectorAll('button[title]:not([aria-label]),a[title]:not([aria-label])').forEach((b) => b.setAttribute('aria-label', b.getAttribute('title')));
      const chev = (root) => root.querySelectorAll && root.querySelectorAll('.cat__chev:not([aria-label])').forEach((b) => b.setAttribute('aria-label', 'Mostrar u ocultar los elementos de la categoría'));
      label(document); chev(document);
      new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('button[title]:not([aria-label])')) n.setAttribute('aria-label', n.getAttribute('title')); label(n); chev(n); } }))).observe(document.body, { childList: true, subtree: true });
      document.body.classList.add('is-ready');
    } catch (e) {
      console.error('[Derrotero] error de arranque', e);
      document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:grid;place-items:center;background:#0A1424;color:#F2EDE0;font:16px Inter,sans-serif;z-index:99999;padding:24px;text-align:center"><div><h2 style="font-family:Cardo,serif">No se pudo iniciar Derrotero</h2><p style="opacity:.7">' + String(e && e.message || e).replace(/</g, '&lt;') + '</p></div></div>');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

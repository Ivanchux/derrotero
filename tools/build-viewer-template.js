#!/usr/bin/env node
/* Genera js/viewer-template.js: el visor completo (HTML + CSS + JS + Leaflet + fuentes)
   en un único texto con el marcador de datos, para la exportación «HTML incrustable».
   Uso: node tools/build-viewer-template.js */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p, enc = 'utf8') => fs.readFileSync(path.join(root, p), enc);

let html = read('index.html');

/* ---- CSS ---- */
const fontData = (m, file) => 'url(data:font/woff2;base64,' + read('vendor/fonts/' + file, 'base64') + ')';
const inlineCss = (p) => read(p)
  .replace(/url\(\.\.\/vendor\/fonts\/([^)]+)\)/g, fontData)
  .replace(/url\(images\/[^)]+\)/g, 'none')
  .replace(/<\/style/gi, '<\\/style');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">\s*/g, (m, href) => '<style>\n' + inlineCss(href) + '\n</style>\n');

/* ---- JS ---- */
const marker = '<script>window.__DERROTERO_VIEW__ = /*__DERROTERO_DATA__*/null;</script>\n';
let first = true;
html = html.replace(/<script src="([^"]+)"([^>]*)><\/script>\s*/g, (m, src, attrs) => {
  if (/data-viewer-skip/.test(attrs)) return '';
  const code = read(src).replace(/<\/script/gi, '<\\/script');
  const out = (first ? marker : '') + '<script>\n' + code + '\n</script>\n';
  first = false;
  return out;
});

html = html.replace(/<title>[^<]*<\/title>/, '<title>Mapa · Derrotero</title>');
if ((html.match(/\/\*__DERROTERO_DATA__\*\/null/g) || []).length < 1) throw new Error('Falta el marcador de datos');

const str = JSON.stringify(html).replace(/<\//g, '<\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const out = '/* Generado por tools/build-viewer-template.js — no editar a mano. */\nwindow.DerroteroViewerTemplate = ' + str + ';\n';
fs.writeFileSync(path.join(root, 'js/viewer-template.js'), out);
console.log('js/viewer-template.js', (out.length / 1024).toFixed(0) + ' KB');

const fs=require('fs'),path=require('path');
const dir=(process.env.LUCIDE_ICONS||path.join(__dirname,'..','node_modules','lucide-static','icons'))+path.sep;
const list=[
['map-pin','Marcador'],['flag','Bandera'],['star','Estrella'],['heart','Corazón'],['bookmark','Marcapáginas'],['target','Objetivo'],['circle-dot','Punto'],['info','Información'],['triangle-alert','Aviso'],['zap','Rayo'],
['gamepad-2','Videojuegos'],['joystick','Joystick'],['swords','Espadas'],['trophy','Trofeo'],['dices','Dados'],['puzzle','Puzzle'],['crown','Corona'],['skull','Calavera'],['ghost','Fantasma'],['gem','Gema'],
['building-2','Edificio'],['factory','Fábrica'],['store','Tienda'],['landmark','Monumento'],['castle','Castillo'],['house','Casa'],['school','Escuela'],['graduation-cap','Formación'],['hospital','Hospital'],['tent-tree','Camping'],
['briefcase','Oficina'],['laptop','Portátil'],['monitor','Monitor'],['server','Servidor'],['cpu','Chip'],['wifi','Wifi'],['plug','Enchufe'],['shield-check','Seguridad'],['radio-tower','Torre de señal'],['flame','Fuego'],
['train-front','Tren'],['bus','Autobús'],['car','Coche'],['square-parking','Aparcamiento'],['bike','Bicicleta'],['plane','Avión'],['ship','Barco'],['anchor','Ancla'],['route','Ruta'],['footprints','Huellas'],
['coffee','Café'],['utensils','Restaurante'],['bed-double','Alojamiento'],['shopping-bag','Compras'],['ticket','Entrada'],['gift','Regalo'],['music','Música'],['camera','Cámara'],['palette','Paleta'],['brush','Pincel'],
['users','Equipo'],['user','Persona'],['handshake','Acuerdo'],['megaphone','Megáfono'],['message-circle','Mensaje'],['newspaper','Prensa'],['book-open','Libro'],['lightbulb','Idea'],['rocket','Cohete'],['euro','Euro'],
['trees','Parque'],['mountain','Montaña'],['sun','Sol'],['moon','Luna'],['compass','Brújula'],['globe','Mundo'],['eye','Observatorio'],['layers','Capas'],['sparkles','Destacado'],['pencil-ruler','Diseño']
];

const ui=['bold','italic','underline','list','list-ordered','heading-2','quote','link','eraser','x','plus','trash-2','pencil','copy','external-link','chevron-left','chevron-right','chevron-up','chevron-down','search','eye','eye-off','play','pause','skip-back','skip-forward','maximize','minimize','download','upload','file-json','settings','menu','panel-left','grip-vertical','check','image','image-plus','crosshair','mouse-pointer-2','spline','pentagon','map-pin-plus','locate-fixed','rotate-ccw','folder-open','copy-plus','save','share-2','code-xml','presentation','map','tags','tag','ruler','arrow-left','arrow-right','ellipsis','undo-2','file-down','file-up','layers','sliders-horizontal','scan','square','circle','expand','shrink','log-in','refresh-cw','unlink','align-left','sun-moon','navigation'];
const out={};const miss=[];

for(const [n,l] of list){const f=dir+n+'.svg';if(!fs.existsSync(f)){miss.push(n);continue}
 let s=fs.readFileSync(f,'utf8');const m=s.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
 out[n]={l,s:m[1].replace(/\s+/g,' ').trim()};}
console.log('missing',miss);
const uiOut={};
for(const n of ui){const f=dir+n+'.svg';if(!fs.existsSync(f)){miss.push(n);continue}
 const m=fs.readFileSync(f,'utf8').match(/<svg[^>]*>([\s\S]*)<\/svg>/);uiOut[n]=m[1].replace(/\s+/g,' ').trim();}
console.log('missing ui',miss);
const js='/* Iconos Lucide (ISC). Generado por tools/gen-icons.js. viewBox 24x24, trazo 2. */\n(function(){window.DerroteroIcons={pick:'+JSON.stringify(out)+',ui:'+JSON.stringify(uiOut)+'};})();\n';
fs.writeFileSync(path.join(__dirname,'..','js','icons-data.js'),js);console.log(Object.keys(out).length,'icons',js.length);

/* Derrotero · mapa de ejemplo: un paseo a pie por el centro de Madrid.
   Monumentos, museos y parques reales, con ubicaciones y trazados aproximados.
   Las imágenes son ilustraciones generadas aquí mismo: sustitúyelas por fotos propias. */
(function () {
  'use strict';
  const D = window.Derrotero;

  /* Imagen de ejemplo generada en SVG (para que la demo funcione sin archivos externos) */
  function ph(title, note, c1, c2, motif) {
    const bldg = () => {
      let s = '';
      const xs = [60, 150, 240, 330, 430, 520, 610, 690];
      const hs = [180, 250, 150, 300, 210, 270, 170, 230];
      xs.forEach((x, i) => {
        const h = hs[i];
        s += `<rect x="${x}" y="${420 - h}" width="70" height="${h}" fill="#0A1424" fill-opacity=".72"/>`;
        for (let r = 0; r < Math.floor(h / 34); r++) for (let c = 0; c < 2; c++) s += `<rect x="${x + 12 + c * 28}" y="${420 - h + 12 + r * 34}" width="14" height="18" fill="${(i + r + c) % 3 === 0 ? '#C9A862' : '#F2EDE0'}" fill-opacity="${(i + r + c) % 3 === 0 ? 0.95 : 0.16}"/>`;
      });
      return s + '<rect x="0" y="420" width="800" height="80" fill="#0A1424" fill-opacity=".55"/>';
    };
    const arch = () => `<g fill="#0A1424" fill-opacity=".72"><path d="M150 420 V250 L400 150 L650 250 V420 Z"/></g><g fill="#F2EDE0" fill-opacity=".18">${[200, 280, 360, 440, 520, 580].map((x) => `<rect x="${x}" y="270" width="26" height="150"/>`).join('')}</g><path d="M150 250 L400 150 L650 250" fill="none" stroke="#C9A862" stroke-width="4"/><rect x="0" y="420" width="800" height="80" fill="#0A1424" fill-opacity=".55"/>`;
    const park = () => `<g fill="#0A1424" fill-opacity=".7">${[[120, 330, 70], [250, 300, 90], [560, 310, 85], [690, 335, 65]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/><rect x="${x - 6}" y="${y}" width="12" height="${420 - y}"/>`).join('')}</g><path d="M330 420 V300 Q400 210 470 300 V420 Z" fill="#F2EDE0" fill-opacity=".14" stroke="#C9A862" stroke-width="3"/><rect x="0" y="420" width="800" height="80" fill="#0A1424" fill-opacity=".55"/>`;
    const art = { bldg, arch, park }[motif] || bldg;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#F2EDE0" stroke-opacity=".07"/></pattern></defs><rect width="800" height="500" fill="url(#g)"/><rect width="800" height="500" fill="url(#p)"/>${art()}<text x="40" y="64" font-family="Georgia,serif" font-size="34" fill="#F2EDE0">${title}</text><text x="40" y="94" font-family="Arial,sans-serif" font-size="15" letter-spacing="2" fill="#C9A862">${note}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  D.buildDemo = () => {
    const C = { mon: 'demo-c-mon', mus: 'demo-c-mus', par: 'demo-c-par', pla: 'demo-c-pla', ruta: 'demo-c-ruta' };
    const categories = [
      { id: C.mon, name: 'Monumentos', color: '#C9A862', icon: 'landmark', visible: true },
      { id: C.mus, name: 'Museos', color: '#5AB0D8', icon: 'palette', visible: true },
      { id: C.par, name: 'Parques y jardines', color: '#5FBFA4', icon: 'trees', visible: true },
      { id: C.pla, name: 'Plazas y mercados', color: '#E0604F', icon: 'store', visible: true },
      { id: C.ruta, name: 'Ruta a pie', color: '#E7C55B', icon: 'footprints', visible: true },
    ];
    const IMG = 'IMAGEN DE EJEMPLO';
    const pt = (id, cat, title, coords, description, extra = {}) => Object.assign({ id, type: 'point', categoryId: cat, title, coords, tags: [], description, links: [], images: [], style: null }, extra);
    const items = [
      pt('demo-debod', C.mon, 'Templo de Debod', [40.4240, -3.7178],
        '<p>Templo egipcio del <b>siglo II a. C.</b> que Egipto regaló a España en agradecimiento por la ayuda para salvar los templos de Nubia. Se montó piedra a piedra en este parque y abrió en 1972.</p><p>Es uno de los mejores sitios de la ciudad para ver el atardecer.</p>',
        { tags: ['inicio', 'atardecer'], images: [{ src: ph('Templo de Debod', IMG, '#3a2a1d', '#0A1424', 'arch'), caption: 'Ilustración de ejemplo' }], links: [{ label: 'esMadrid, turismo oficial de Madrid', url: 'https://www.esmadrid.com/' }], style: { size: 'l' } }),
      pt('demo-palacio', C.mon, 'Palacio Real', [40.4179, -3.7143],
        '<p>Residencia oficial de la Corona, aunque hoy se usa sobre todo para ceremonias de Estado. Se construyó en el <b>siglo XVIII</b> sobre el solar del antiguo alcázar y tiene <b>más de 3.000 salas</b>.</p><h3>Consejo</h3><ul><li>Compra la entrada con antelación.</li><li>Desde los jardines de Sabatini hay buena vista de la fachada norte.</li></ul>',
        { tags: ['patrimonio'], images: [{ src: ph('Palacio Real', IMG, '#16294A', '#0A1424', 'arch'), caption: 'Ilustración de ejemplo' }], links: [{ label: 'Patrimonio Nacional', url: 'https://www.patrimonionacional.es/' }], style: { size: 'l' } }),
      pt('demo-almudena', C.mon, 'Catedral de la Almudena', [40.4157, -3.7145],
        '<p>Frente al Palacio Real. Sus obras empezaron en 1883 y no se consagró hasta <b>1993</b>, así que mezcla estilos de más de un siglo.</p>',
        { tags: ['patrimonio'], style: { size: 's' } }),
      pt('demo-sanmiguel', C.pla, 'Mercado de San Miguel', [40.4154, -3.7090],
        '<p>Mercado de estructura de hierro de <b>1916</b>, hoy convertido en un espacio de tapas y producto. Buena parada para comer algo a mitad de ruta.</p>',
        { tags: ['comer'], style: { icon: 'utensils' } }),
      pt('demo-plazamayor', C.pla, 'Plaza Mayor', [40.4155, -3.7074],
        '<p>Plaza porticada de principios del <b>siglo XVII</b>. Ha sido mercado, plaza de toros y escenario de fiestas. En diciembre acoge el mercado navideño.</p>',
        { tags: ['patrimonio'], images: [{ src: ph('Plaza Mayor', IMG, '#4a2a1d', '#0A1424', 'bldg'), caption: 'Ilustración de ejemplo' }] }),
      pt('demo-sol', C.pla, 'Puerta del Sol', [40.4169, -3.7036],
        '<p>En el suelo, frente a la Real Casa de Correos, está la placa del <b>kilómetro cero</b> de las carreteras radiales. Su reloj da las campanadas de Nochevieja.</p>',
        { tags: ['centro'] }),
      pt('demo-metropolis', C.mon, 'Edificio Metrópolis', [40.4189, -3.6973],
        '<p>Edificio de <b>1911</b> en el cruce de Gran Vía y Alcalá, rematado por una cúpula con una Victoria alada. Es la foto clásica del inicio de la Gran Vía.</p>',
        { tags: ['arquitectura'], style: { size: 's' } }),
      pt('demo-cibeles', C.mon, 'Plaza de Cibeles', [40.4193, -3.6931],
        '<p>Fuente del <b>siglo XVIII</b> con la diosa Cibeles en un carro tirado por leones. Detrás, el Palacio de Cibeles, sede del Ayuntamiento, con un mirador en la última planta.</p>',
        { tags: ['patrimonio', 'mirador'] }),
      pt('demo-prado', C.mus, 'Museo del Prado', [40.4138, -3.6921],
        '<p>Abrió en <b>1819</b> y guarda una de las mejores colecciones de pintura europea: Velázquez, Goya, El Bosco o Tiziano. Las dos últimas horas del día la entrada es gratuita.</p>',
        { tags: ['arte'], images: [{ src: ph('Museo del Prado', IMG, '#1b3a63', '#0A1424', 'arch'), caption: 'Ilustración de ejemplo' }], links: [{ label: 'Web del Museo del Prado', url: 'https://www.museodelprado.es/' }], style: { size: 'l' } }),
      pt('demo-thyssen', C.mus, 'Museo Thyssen-Bornemisza', [40.4161, -3.6949],
        '<p>Completa al Prado y al Reina Sofía con pintura desde el gótico hasta el pop art.</p>',
        { tags: ['arte'], style: { size: 's' } }),
      pt('demo-reinasofia', C.mus, 'Museo Reina Sofía', [40.4081, -3.6944],
        '<p>Arte moderno y contemporáneo. Aquí está el <b>Guernica</b> de Picasso.</p>',
        { tags: ['arte'], style: { size: 's' } }),
      pt('demo-alcala', C.mon, 'Puerta de Alcalá', [40.4200, -3.6888],
        '<p>Puerta monumental que Carlos III encargó a Sabatini y que se terminó en <b>1778</b>. Marca la esquina noroeste del Retiro.</p>',
        { tags: ['patrimonio'], style: { size: 's' } }),
      pt('demo-estanque', C.par, 'Estanque Grande del Retiro', [40.4182, -3.6836],
        '<p>Se pueden alquilar barcas de remo. Al lado está el monumento a Alfonso XII, con su columnata.</p>',
        { tags: ['paseo'], style: { icon: 'ship', size: 's' } }),
      pt('demo-cristal', C.par, 'Palacio de Cristal', [40.4137, -3.6821],
        '<p>Pabellón de hierro y cristal levantado en <b>1887</b> para una exposición. Hoy acoge exposiciones temporales de arte contemporáneo y es el final de la ruta.</p>',
        { tags: ['final', 'arte'], images: [{ src: ph('Palacio de Cristal', IMG, '#143a3a', '#0A1424', 'park'), caption: 'Ilustración de ejemplo' }], style: { size: 'l' } }),
      {
        id: 'demo-ruta', type: 'line', categoryId: C.ruta, title: 'Ruta a pie: de Debod al Retiro', tags: ['ruta'],
        coords: [[40.4240, -3.7178], [40.4233, -3.7140], [40.4205, -3.7136], [40.4183, -3.7128], [40.4162, -3.7138], [40.4155, -3.7118], [40.4156, -3.7100], [40.4154, -3.7090], [40.4155, -3.7074], [40.4163, -3.7055], [40.4169, -3.7036], [40.4180, -3.7010], [40.4189, -3.6973], [40.4193, -3.6931], [40.4170, -3.6933], [40.4150, -3.6928], [40.4138, -3.6921], [40.4146, -3.6903], [40.4152, -3.6872], [40.4162, -3.6852], [40.4150, -3.6832], [40.4137, -3.6821]],
        description: '<p>Unos <b>6 km</b> sin cuestas fuertes, de oeste a este. A paso tranquilo y con paradas cortas se hace en una mañana; con visitas a museos, en el día entero.</p><p><i>Trazado aproximado, dibujado a mano para el ejemplo.</i></p>',
        links: [], images: [], style: { weight: 5, dash: true },
      },
      {
        id: 'demo-retiro', type: 'area', categoryId: C.par, title: 'Parque del Retiro', tags: ['parque'],
        coords: [[40.4207, -3.6873], [40.4209, -3.6800], [40.4193, -3.6766], [40.4102, -3.6760], [40.4077, -3.6797], [40.4085, -3.6880], [40.4150, -3.6890], [40.4195, -3.6882]],
        description: '<p>Unas <b>118 hectáreas</b> de jardines que fueron de la Corona hasta finales del siglo XIX. Junto con el Paseo del Prado forma parte del <b>Paisaje de la Luz</b>, Patrimonio Mundial desde 2021.</p><p><i>Contorno aproximado.</i></p>',
        links: [{ label: 'UNESCO · Paisaje de la Luz', url: 'https://whc.unesco.org/es/list/1618' }], images: [], style: { fill: 0.14 },
      },
      {
        id: 'demo-paseoarte', type: 'area', categoryId: C.mus, title: 'Paseo del Arte', tags: ['arte'],
        coords: [[40.4198, -3.6962], [40.4198, -3.6912], [40.4120, -3.6905], [40.4075, -3.6925], [40.4075, -3.6962], [40.4125, -3.6962]],
        description: '<p>El Prado, el Thyssen y el Reina Sofía están a menos de 1 km entre sí. Con el abono Paseo del Arte se entra una vez en cada uno.</p><p><i>Zona aproximada.</i></p>',
        links: [], images: [], style: { fill: 0.1, dash: true },
      },
    ];
    const order = ['demo-ruta', 'demo-debod', 'demo-palacio', 'demo-sanmiguel', 'demo-plazamayor', 'demo-sol', 'demo-metropolis', 'demo-cibeles', 'demo-prado', 'demo-retiro', 'demo-cristal'];
    const zoom = { 'demo-ruta': 14, 'demo-retiro': 15 };
    return {
      format: 'derrotero', version: 1, id: D.uid('p'),
      meta: {
        title: 'Un paseo por Madrid',
        subtitle: 'Del Templo de Debod al Retiro en un día',
        author: 'Mapa de ejemplo',
        description: 'Ruta a pie de unos 6 km por el centro de Madrid: palacios, plazas, los tres grandes museos y el Retiro.\n\nEs un mapa de ejemplo, con ubicaciones y trazados aproximados e imágenes ilustrativas. Pulsa «Presentar» para verlo como recorrido o crea uno propio desde la pestaña Mapa.',
        created: Date.now(), updated: Date.now(),
      },
      view: { center: [40.4165, -3.7000], zoom: 14, base: 'night' },
      settings: { cluster: true, clusterRadius: 45, labels: false, tourZoom: 17, flyDuration: 2.4, stepDelay: 8, route: true, intro: true },
      categories, items,
      tour: { steps: order.map((id) => ({ itemId: id, zoom: zoom[id] || null })) },
    };
  };
})();

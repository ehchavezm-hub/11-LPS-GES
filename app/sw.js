// Service worker de LPS-GT: instalación como aplicación (M-12) y consulta sin conexión (M-13, lectura).
// La versión cambia en cada publicación para que los usuarios reciban la última versión.
const VERSION = 'lpsgt-v1.0.0';
const ARCHIVOS = [
  './',
  'index.html',
  'config.js',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/ui/grid.js',
  'js/ui/layout.js',
  'js/ui/ui.js',
  'js/services/columnas.js',
  'js/services/importar.js',
  'js/services/indicadores.js',
  'js/services/pdf.js',
  'js/services/resumen.js',
  'js/services/traer-demo.js',
  'js/views/actividad.js',
  'js/views/ayuda.js',
  'js/views/cartera.js',
  'js/views/config.js',
  'js/views/detalle.js',
  'js/views/equipo.js',
  'js/views/login.js',
  'js/views/lookahead.js',
  'js/views/mejoras.js',
  'js/views/plan.js',
  'js/views/plantillas.js',
  'js/views/proyectos.js',
  'js/views/restricciones.js',
  'js/views/reunion.js',
  'js/views/tablero.js',
  'js/views/organigrama.js',
  'js/views/importar-proyectos.js',
  'js/views/traer-demo.js',
  'js/data/adapter-demo.js',
  'js/data/adapter-supabase.js',
  'js/data/api.js',
  'js/data/catalogos.js',
  'js/data/demo-seed.js',
  'js/core/router.js',
  'js/core/store.js',
  'js/core/util.js',
  'js/core/monitoreo.js',
  'vendor/chart.umd.min.js',
  'vendor/supabase.min.js',
  'vendor/tabulator.min.css',
  'vendor/tabulator.min.js',
  'vendor/xlsx.full.min.js',
  'img/icono-192.png',
  'img/icono-512.png',
  'img/icono.svg',
];

self.addEventListener('install', e => {
  // cache: 'reload' evita copiar al service worker archivos viejos de la caché HTTP del navegador
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(a => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== 'lpsgt-datos').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Datos de Supabase (REST): primero la red; sin conexión, la última respuesta guardada (solo lectura)
  if (url.pathname.startsWith('/rest/v1/')) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open('lpsgt-datos').then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || new Response('[]', { headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  if (url.origin !== location.origin && !url.hostname.endsWith('fonts.googleapis.com') && !url.hostname.endsWith('fonts.gstatic.com')) return;
  // Librerías y fuentes: primero la caché. Código del aplicativo: primero la red (para recibir actualizaciones).
  const primeroCache = url.pathname.includes('/vendor/') || url.hostname.includes('fonts.');
  if (primeroCache) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); return res;
    })));
  } else {
    // GitHub Pages permite al navegador reutilizar archivos 10 minutos: 'no-cache' obliga a confirmar con el servidor
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
  }
});

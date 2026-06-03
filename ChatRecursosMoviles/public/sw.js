importScripts('https://cdn.jsdelivr.net/npm/pouchdb@7.0.0/dist/pouchdb.min.js');
importScripts('js/sw-db.js');
importScripts('js/sw-utils.js');

const STATIC_CACHE    = 'ss-static-v1';
const DYNAMIC_CACHE   = 'ss-dynamic-v1';
const INMUTABLE_CACHE = 'ss-inmutable-v1';

const APP_SHELL = [
  '/',
  'index.html',
  'css/style.css',
  'img/favicon.ico',
  'img/avatars/avatar1.png',
  'img/avatars/avatar2.png',
  'img/avatars/avatar3.png',
  'img/avatars/avatar4.png',
  'js/app.js',
  'js/camara-class.js',
  'js/sw-utils.js',
  'js/libs/plugins/mdtoast.min.js',
  'js/libs/plugins/mdtoast.min.css'
];

const APP_SHELL_INMUTABLE = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Fraunces:wght@600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/animate.css/3.7.0/animate.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/pouchdb@7.0.0/dist/pouchdb.min.js'
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  const cacheStatic = caches.open(STATIC_CACHE).then(cache =>
    cache.addAll(APP_SHELL)
  );
  const cacheInmutable = caches.open(INMUTABLE_CACHE).then(cache =>
    cache.addAll(APP_SHELL_INMUTABLE)
  );
  e.waitUntil(Promise.all([cacheStatic, cacheInmutable]));
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  const respuesta = caches.keys().then(keys => {
    return Promise.all(keys.map(key => {
      if (key !== STATIC_CACHE    && key.includes('ss-static'))    return caches.delete(key);
      if (key !== DYNAMIC_CACHE   && key.includes('ss-dynamic'))   return caches.delete(key);
      if (key !== INMUTABLE_CACHE && key.includes('ss-inmutable')) return caches.delete(key);
    }));
  });
  e.waitUntil(respuesta);
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  let respuesta;

  if (e.request.url.includes('/api')) {
    respuesta = manejoApiMensajes(DYNAMIC_CACHE, e.request);
  } else {
    respuesta = caches.match(e.request).then(res => {
      if (res) {
        actualizaCacheStatico(STATIC_CACHE, e.request, APP_SHELL_INMUTABLE);
        return res;
      }
      return fetch(e.request).then(newRes =>
        actualizaCacheDinamico(DYNAMIC_CACHE, e.request, newRes)
      );
    });
  }

  e.respondWith(respuesta);
});

// ── SYNC ──────────────────────────────────────────────────────────────────────
// Persona 3 amplía esto con Background Sync completo
self.addEventListener('sync', e => {
  if (e.tag === 'nuevo-post') {
    e.waitUntil(postearMensajes());
  }
});

// ── PUSH ──────────────────────────────────────────────────────────────────────
// Persona 4 amplía esto con las notificaciones completas
self.addEventListener('push', e => {
  const data = JSON.parse(e.data.text());
  e.waitUntil(
    self.registration.showNotification(data.titulo, {
      body:  data.cuerpo,
      icon:  "img/avatars/" + data.usuario + ".png",
      badge: 'img/favicon.ico',
      data:  { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll().then(clientes => {
      const visible = clientes.find(c => c.visibilityState === 'visible');
      if (visible) {
        visible.navigate('/');
        visible.focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
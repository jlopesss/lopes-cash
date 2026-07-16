const CACHE_NAME = 'lopes-cash-v30';
const SHELL = [
  '/',
  '/index.html',
  '/auth.html',
  '/manifest.json',
  '/css/tokens.css',
  '/css/base.css',
  '/css/auth.css',
  '/css/app.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/db.js',
  '/js/offline-queue.js',
  '/js/reorder.js',
  '/js/home.js',
  '/js/historico.js',
  '/js/perfil.js',
  '/js/graficos.js',
  '/js/expense-modal.js',
  '/js/app.js',
  '/js/auth.js',
  '/img/icons/lopes-cash-icon-192.png',
  '/img/icons/lopes-cash-icon-512.png',
  '/img/icons/lopes-cash-icon.svg',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap',
];

// `cache: 'reload'` ignora o cache HTTP do navegador. Sem isso, o max-age=3600
// dos .js no vercel.json faz o addAll gravar JS de até 1h atrás junto com um
// index.html novo — o cache do SW precisa ser um retrato de UM deploy só.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// skipWaiting + claim continuam (a versão nova precisa assumir logo), mas agora
// o app recarrega ao receber `controllerchange` (ver topo do app.js). Sem esse
// reload, a troca no meio do carregamento deixava a página com o index.html do
// cache antigo buscando os scripts do novo — e um app.js novo com um HTML velho
// morre no primeiro getElementById que só existe no HTML novo.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase: network-first, retorna JSON de erro se offline
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(
        JSON.stringify({ error: 'offline' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Google Fonts: network-first com fallback para cache
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first para assets do shell
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

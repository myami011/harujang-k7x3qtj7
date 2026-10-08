/* 하루장 service worker: 앱 파일을 폰에 보관해 오프라인에서도 열리게 한다.
   기록 데이터는 여기서 다루지 않는다(IndexedDB에 따로 저장됨). */
const VER = 'harujang-v5';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VER).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 저장해 둔 파일을 먼저 보여 주고, 인터넷이 되면 뒤에서 새 버전으로 갱신한다. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  e.respondWith((async () => {
    const cache = await caches.open(VER);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') {
      return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
    }
    return Response.error();
  })());
});

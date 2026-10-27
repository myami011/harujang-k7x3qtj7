/* © 2026 Dongwook Kim <myami011@gmail.com> (GitHub: myami011). All rights reserved. */
const VER = 'harujang-v9998';
const ST = 'harujang-state', STK = './__state';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];
const getSt = async () => {
  try { const r = await (await caches.open(ST)).match(STK); return r ? await r.json() : null; } catch (_) { return null; }
};
const putSt = async (s) => {
  await (await caches.open(ST)).put(STK, new Response(JSON.stringify(s), { headers: { 'Content-Type': 'application/json' } }));
};
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const st = await getSt();
    if (st && st.pol !== 'notify' && !(st.allow && Date.now() - st.allow < 120000)) throw new Error('manual');
    const c = await caches.open(VER);
    await c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    if (!st) {
      const olds = (await caches.keys()).filter((k) => k.indexOf('harujang-v') === 0 && k !== VER).sort();
      await putSt({ cur: VER, prev: olds.length ? olds[olds.length - 1] : null, pol: 'manual' });
      await self.skipWaiting();
    }
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const st = await getSt();
    const keep = [ST, VER, st && st.cur, st && st.prev];
    await Promise.all((await caches.keys()).filter((k) => keep.indexOf(k) < 0).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('u')) return; 
  e.respondWith((async () => {
    const st = await getSt();
    let name = null;
    for (const n of [st && st.cur, st && st.prev, VER]) { if (n && (await caches.has(n))) { name = n; break; } }
    if (name) {
      const cache = await caches.open(name);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
    }
    try { return await fetch(req); } catch (_) {
      if (req.mode === 'navigate' && name) {
        const c = await caches.open(name);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
      return Response.error();
    }
  })());
});

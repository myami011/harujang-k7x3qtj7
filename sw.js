/* © 2026 Dongwook Kim <myami011@gmail.com> (GitHub: myami011). All rights reserved. */
/* 하루장 service worker: 앱 파일을 폰에 보관해 서버 없이도 열리게 한다. 기록 데이터는 여기서 다루지 않는다(IndexedDB 에 따로 저장됨).
   원칙: ① 앱은 폰에 저장된 '현재 버전'만 보여 준다(서버에서 몰래 덮어쓰지 않는다)
         ② 새 버전은 따로 받아 두기만 하고, 바꾸는 것(포인터 변경)은 앱 화면에서 사용자가 한다
         ③ 이전 버전을 한 벌 더 보관해 언제든 되돌릴 수 있다
   상태 파일(harujang-state/./__state): {cur 지금 버전 보관함, prev 이전 버전 보관함, pol 'manual'|'notify', allow 받기 허용 시각}
   수동(manual)일 때는 사용자가 [업데이트]를 눌러 allow 를 켠 동안만 새 버전을 받는다(그 밖의 설치는 중단). */
const VER = 'harujang-v99992';
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
    /* 수동 모드: 사용자가 업데이트를 누르지 않았으면 새 버전을 받지 않는다(설치를 중단) */
    if (st && st.pol !== 'notify' && !(st.allow && Date.now() - st.allow < 120000)) throw new Error('manual');
    const c = await caches.open(VER);
    await c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    if (!st) {
      /* 처음 설치(또는 이 방식으로 처음 바뀔 때): 이 버전을 지금 버전으로 삼고, 있던 이전 보관함을 이전 버전으로 남긴다 */
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

/* 보관해 둔 현재 버전만 보여 준다. 서버 응답으로 보관본을 바꾸지 않는다. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('u')) return; /* 업데이트 확인은 항상 인터넷에서 */

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

/* AIERP 抄貨 離線快取（由 build-site.js 產生，版本 1f09708437）
 * - 網頁本身：有網路先拿最新的，沒網路用上次存的 → 沒訊號也打得開
 * - 條碼辨識程式、圖示：存起來直接用
 * - 跟雲端要資料（script.google.com）一律不碰，資料的離線由網頁自己存
 */
const CACHE = 'aierp-chaohuo-__VER__';
const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    try { await c.add(new Request(ZXING, { mode: 'cors' })); } catch (err) { /* 沒網路下次再存 */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('aierp-chaohuo-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
      // 網頁：網路優先，3 秒沒回就用存的（訊號很差時不要卡住）
      e.respondWith((async () => {
        const c = await caches.open(CACHE);
        const net = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; });
        const slow = new Promise(ok => setTimeout(ok, 3000));
        try {
          const r = await Promise.race([net, slow.then(() => null)]);
          if (r) return r;
          return (await c.match('./index.html')) || await net;
        } catch (err) {
          return (await c.match('./index.html')) || Response.error();
        }
      })());
      return;
    }
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }
  if (req.url === ZXING) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    }));
  }
});

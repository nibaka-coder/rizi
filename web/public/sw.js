/* PWA 缓存策略
   - 静态资源：缓存优先，秒开（Vite 产物带 hash，缓存安全）
   - 页面/API：stale-while-revalidate，先用缓存秒开，后台静默更新
   - 写操作后的刷新请求带 X-Rizi-Refresh，强制走网络，保证数据实时
*/
const CACHE = 'rizi-v3';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 先回缓存秒开，后台拉新写入缓存
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

// 缓存优先，未命中再走网络并缓存
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 写操作后的刷新：强制网络优先，保证拿到最新数据
  if (req.headers.has('x-rizi-refresh')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // API：先缓存秒开，后台更新
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 导航/页面：先缓存秒开，后台更新
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 其余静态资源：缓存优先
  e.respondWith(cacheFirst(req));
});

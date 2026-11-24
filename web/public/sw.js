/* PWA 缓存策略（含认证安全）
   - 静态资源：缓存优先，秒开（Vite 产物带 hash，缓存安全）
   - 页面外壳：stale-while-revalidate
   - 数据 API：stale-while-revalidate，但只缓存成功的 200 响应（401 等绝不缓存）
   - 认证接口 /api/auth/*：绝不缓存，始终走网络
   - 退出登录：前端发消息 CLEAR_DATA，清空数据缓存，杜绝登出后从缓存看到旧数据
*/
const CACHE = 'rizi-v5';          // 静态外壳
const DATA_CACHE = 'rizi-data-v5'; // 数据接口（登出时清空）
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
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 退出登录时清空数据缓存
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CLEAR_DATA') {
    e.waitUntil(caches.delete(DATA_CACHE));
  }
});

// 数据 API：先回缓存秒开，后台拉新；只缓存成功响应
async function dataStaleWhileRevalidate(req) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()); // 401/500 不缓存
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

// 页面外壳：先缓存秒开，后台更新，只缓存成功响应
async function shellStaleWhileRevalidate(req) {
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

// 静态资源缓存优先
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

  // 认证接口：绝不缓存，始终网络
  if (url.pathname.startsWith('/api/auth/')) {
    e.respondWith(fetch(req));
    return;
  }

  // 写操作后的刷新：强制网络优先，保证最新；401 不缓存
  if (req.headers.has('x-rizi-refresh')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 数据 API：独立缓存，登出可清
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(dataStaleWhileRevalidate(req));
    return;
  }

  // 导航/页面外壳
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(shellStaleWhileRevalidate(req));
    return;
  }

  // 其余静态资源
  e.respondWith(cacheFirst(req));
});

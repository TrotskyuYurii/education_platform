// Service worker навчального порталу: оболонка додатку офлайн + зображення
// збережених для офлайну матеріалів.
//
// Що кешується:
//  - оболонка (index.html, хешовані чанки /assets, іконки, шрифти) — щоб додаток
//    відкривався без мережі;
//  - зображення інструкцій, які користувач явно зберіг офлайн (кеш MATERIALS_CACHE
//    наповнює сама сторінка, див. src/utils/offlineLibrary.ts).
//
// Що НЕ кешується: відповіді /api (крім зображень матеріалів). Дані сесії, прогрес
// і питання тестів завжди йдуть із сервера; офлайн-копію матеріалів сторінка
// тримає в IndexedDB окремо для кожного користувача.
const SHELL_CACHE = 'viatec-shell-v2';
const ASSETS_CACHE = 'viatec-assets-v2';
const FONTS_CACHE = 'viatec-fonts-v1';
// Назву поділяє з цим файлом src/utils/offlineLibrary.ts.
const MATERIALS_CACHE = 'viatec-materials-v1';
const KEEP = [SHELL_CACHE, ASSETS_CACHE, FONTS_CACHE, MATERIALS_CACHE];

const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/';
const SHELL_STATIC = [OFFLINE_URL, '/icon.svg', '/manifest.webmanifest'];
// Старі хешовані чанки після релізів більше не потрібні — тримаємо обмежену кількість.
const MAX_ASSET_ENTRIES = 250;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Сторінка після першого завантаження передає список уже отриманих чанків:
// до встановлення воркера ці запити пройшли повз нього й не потрапили в кеш.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil(cacheUrls(data.urls));
  }
});

async function cacheUrls(urls) {
  const shell = await caches.open(SHELL_CACHE);
  const assets = await caches.open(ASSETS_CACHE);
  await Promise.all(urls.map(async (raw) => {
    try {
      const url = new URL(raw, self.location.origin);
      if (url.origin !== self.location.origin) return;
      const isShell = url.pathname === SHELL_URL;
      const cache = isShell ? shell : assets;
      if (!isShell && await cache.match(url.pathname)) return;
      const res = await fetch(url.pathname, { credentials: 'same-origin' });
      if (res.ok) await cache.put(isShell ? SHELL_URL : url.pathname, res);
    } catch {
      // Окремий файл не завантажився — решта кешується далі.
    }
  }));
  await trimCache(ASSETS_CACHE, MAX_ASSET_ENTRIES);
}

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // keys() повертає записи в порядку додавання — видаляємо найстаріші.
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, ASSETS_CACHE));
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      // Зображення інструкцій: із мережі, а без неї — з офлайн-кешу матеріалів.
      if (/^\/api\/sections\/[^/]+\/assets\//.test(url.pathname)) {
        event.respondWith(networkFirst(request, MATERIALS_CACHE, false));
      }
      return;
    }
    if (SHELL_STATIC.includes(url.pathname)) {
      event.respondWith(networkFirst(request, SHELL_CACHE, true));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONTS_CACHE));
    return;
  }

  // Зовнішні зображення, збережені разом з матеріалом (якщо вдалося їх закешувати).
  if (request.destination === 'image') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request.url, { cacheName: MATERIALS_CACHE })) || Response.error())
    );
  }
});

async function handleNavigation(request) {
  try {
    const res = await fetch(request);
    // Свіжу оболонку зберігаємо лише для SPA-сторінок, а не для файлів чи API.
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(SHELL_URL, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(SHELL_URL)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  // opaque (status 0) — крос-доменні шрифти без CORS; їх теж можна віддавати з кешу.
  if (res.ok || res.type === 'opaque') {
    await cache.put(request, res.clone());
    if (cacheName === ASSETS_CACHE) trimCache(ASSETS_CACHE, MAX_ASSET_ENTRIES);
  }
  return res;
}

async function networkFirst(request, cacheName, store) {
  try {
    const res = await fetch(request);
    if (store && res.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request, { cacheName, ignoreSearch: true });
    return cached || Response.error();
  }
}

// v1.3.0 - Service Worker for offline PWA support

const CACHE_VERSION = 'v1.3.0';
const CACHE_NAME = `unicorn-run-${CACHE_VERSION}`;

// Assets to cache on install
// Use relative paths - service worker will resolve these relative to its location
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './game.js',
  './config.js',
  './entities.js',
  './maze.js',
  './levels.js',
  './movement.js',
  './ai.js',
  './rendering.js',
  './input.js',
  './utils.js',
  './storage.js',
  './highscores.js',
  './styles.css',
  './manifest.json',
  './icons/unicorn_run.png',
  './icons/unicorn_run_icnos.png'
];

// Install event: cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching assets');
        return cache.addAll(ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch((error) => {
        console.error('[Service Worker] Failed to cache assets:', error);
      })
  );
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Don't cache dynamic data or remote APIs
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/') || url.pathname.includes('?nocache=')) {
    return; // Let it go to network
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response for caching
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Network failed, return offline fallback if available
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});


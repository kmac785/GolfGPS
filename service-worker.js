const CACHE_NAME = 'golf-gps-v6';

const APP_SHELL = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './manifest.json',
    './icons/icon.svg',
    'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
    'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
    'https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js'
];

// Install — cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — cache-first for app shell, network-first for API/tiles
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API and tile requests — always go to network
    if (url.hostname === 'api.maptiler.com' ||
        url.hostname === 'api.open-meteo.com') {
        event.respondWith(fetch(event.request));
        return;
    }

    // Everything else — cache first, fall back to network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // Cache new successful responses for same-origin or CDN resources
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});

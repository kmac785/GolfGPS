const CACHE_NAME = 'golf-gps-v25';

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

// Install — nuke ALL old caches, then cache new app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((k) => caches.delete(k)))
        ).then(() =>
            caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
        )
    );
    // Force this SW to activate immediately (don't wait for old tabs to close)
    self.skipWaiting();
});

// Activate — claim all clients immediately so new SW takes over right away
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch — network-first for same-origin files, cache-first for CDN libs
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API and tile requests — always network
    if (url.hostname === 'api.maptiler.com' ||
        url.hostname === 'api.open-meteo.com') {
        event.respondWith(fetch(event.request));
        return;
    }

    // Same-origin files (our code) — network first, fall back to cache
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // CDN libs — cache first (they're versioned URLs, won't change)
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});

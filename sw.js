const CACHE_NAME = "canfenci-cache-v75";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192x192-maskable.png",
  "./firebase-config.js",
  "./store.js",
  "./data-validation.js",
  "./ui-helpers.js",
  "./auth.js",
  "./teacher-profile.js",
  "./students.js",
  "./guidance.js",
  "./student-insights.js",
  "./study-plan-engine.js",
  "./exams.js",
  "./homework.js",
  "./schedule.js",
  "./schedule-conflicts.js",
  "./lesson-reminders.js",
  "./lesson-reminder-insights.js",
  "./weekly-goal-insights.js",
  "./finance.js",
  "./lesson-date-utils.js",
  "./lesson-finance-insights.js",
  "./topic-exam-insights.js",
  "./resource-books.js",
  "./homework-error-topics.js",
  "./work-performance-insights.js",
  "./growth.js",
  "./groups.js"
];

// Install Service Worker
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("[Service Worker] Pre-caching offline assets");
        // We use cache.addAll but catch individual failures to avoid breaking install if one CDN has transient issues
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`[Service Worker] Failed to pre-cache asset: ${url}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Cleaning old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Assets
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return;
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.search) return;

  const isFreshnessCritical = event.request.mode === "navigate" || ['document', 'script', 'style'].includes(event.request.destination);
  if (isFreshnessCritical) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache and update in background (Stale-While-Revalidate)
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {}); // Ignore network errors offline
          return cachedResponse;
        }

        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "error") {
              return networkResponse;
            }

            // Dynamically cache any other runtime requests (like font files)
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // Fallback for navigation requests
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
          });
      })
  );
});

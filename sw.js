const CACHE_NAME = "clob-pack05-part1-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/base.css",
  "./css/components.css",
  "./css/app.css",
  "./js/app.js",
  "./js/config.js",
  "./js/firebase.js",
  "./js/member.js",
  "./js/members.js",
  "./js/members-page.js",
  "./js/router.js",
  "./js/trainer.js",
  "./js/trainer-dashboard.js",
  "./js/views.js",
  "./js/workout.js",
  "./manifest.json",
  "./assets/logo.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => caches.match("./index.html"))
    )
  );
});

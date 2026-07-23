const CACHE_NAME = "clob-patch-008-coach-upload-avatar-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/logo.svg",
  "./css/base.css",
  "./css/components.css",
  "./css/app.css",
  "./js/app.js",
  "./js/config.js",
  "./js/firebase.js",
  "./js/profile-photo-service.js",
  "./js/router.js",
  "./js/views.js",
  "./js/member.js",
  "./js/members.js",
  "./js/members-page.js",
  "./js/member-today-page.js",
  "./js/member-profile-page.js",
  "./js/member-progress-page.js",
  "./js/member-weekly-update-page.js",
  "./js/member-management-page.js",
  "./js/package-management.js",
  "./js/member-experience.js",
  "./js/workout.js",
  "./js/programs.js",
  "./js/data-normalizer.js",
  "./js/program-builder.js",
  "./js/exercise-library.js",
  "./js/exercise-library-page.js",
  "./js/checkins.js",
  "./js/progress-page.js",
  "./js/progress-charts.js",
  "./js/progress-photos-page.js",
  "./js/prs.js",
  "./js/image-processor.js",
  "./js/trainer.js",
  "./js/trainer-profile.js",
  "./js/trainer-security.js",
  "./js/trainer-dashboard.js",
  "./js/trainer-dashboard-page.js",
  "./js/trainer-settings-page.js",
  "./js/weekly-checkins.js",
  "./js/weekly-checkin-page.js",
  "./js/online-coaching.js",
  "./js/data-safety.js",
  "./js/beta-control-page.js",
  "./js/utils.js"
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
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const url = new URL(request.url);

  // HTML navigation: use the newest deployment first.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Only handle same-origin static assets.
  if (url.origin !== self.location.origin) return;

  // Static assets: cache first, then network. Never replace missing JS/CSS with HTML.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

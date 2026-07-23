const CACHE_NAME = "morning-warrior-v2-nutrition-ai-beta-hotfix-4";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/logo.svg",
  "./css/base.css",
  "./css/components.css",
  "./css/app.css",
  "./css/design-system.css",
  "./css/nutrition.css",
  "./js/app.js?v=hotfix-4",
  "./js/config.js",
  "./js/coach-session.js",
  "./js/firebase.js",
  "./js/profile-photo-service.js",
  "./js/router.js",
  "./js/views.js",
  "./js/member.js",
  "./js/members.js",
  "./js/members-page.js",
  "./js/member-today-page.js",
  "./js/dynamic-home.js",
  "./js/emotion-design.js",
  "./js/nutrition.js",
  "./js/nutrition-page.js",
  "./js/ai-food-estimator.js",
  "./js/trainer-nutrition-page.js",
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
      fetch(request, { cache: "no-store" })
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

  // Version-sensitive assets must prefer the current deployment. This prevents
  // a new HTML shell from running an older config.js from a previous PWA cache.
  if (/\.(?:js|css|json)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other same-origin assets remain cache-first for offline startup.
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

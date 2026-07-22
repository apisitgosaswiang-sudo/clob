const CACHE_NAME = "clob-pack10-hotfix01-v1";
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
  "./js/programs.js",
  "./js/program-builder.js",
  "./js/exercise-library.js",
  "./js/exercise-library-page.js",
  "./js/image-processor.js",
  "./js/progress-photos-page.js",
  "./js/checkins.js",
  "./js/progress-page.js",
  "./js/progress-charts.js",
  "./js/prs.js",
  "./js/utils.js",
  "./js/trainer-profile.js",
  "./js/online-coaching.js",
  "./js/trainer-dashboard-page.js",
  "./js/trainer-settings-page.js",
  "./js/weekly-checkins.js",
  "./js/weekly-checkin-page.js",
  "./js/member-experience.js",
  "./js/data-safety.js",
  "./js/member-today-page.js",
  "./js/member-profile-page.js",
  "./js/beta-control-page.js",
  "./js/router.js",
  "./js/trainer.js",
  "./js/trainer-dashboard.js",
  "./js/views.js",
  "./js/workout.js",
  "./manifest.json",
  "./assets/logo.svg"
  "./js/member-management-page.js",
  "./js/member-progress-page.js",
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

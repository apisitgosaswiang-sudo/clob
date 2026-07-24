import { initializeFirebase } from "./firebase.js";
import { registerRoute, registerPatternRoute, startRouter } from "./router.js";
import {
  renderLanding,
  renderTrainerLogin,
  renderNotFound
} from "./views.js";
import {
  renderWorkoutOverview,
  renderExerciseTracker,
  renderWorkoutComplete
} from "./workout.js";
import { renderMembersPage, renderMemberDetail } from "./members-page.js";
import { renderProgramsPage, renderProgramBuilder } from "./program-builder.js";
import { renderExerciseLibraryPage } from "./exercise-library-page.js";
import { renderProgressPhotosPage } from "./progress-photos-page.js";
import { renderProgressPage } from "./progress-page.js";
import { renderTrainerDashboardPage } from "./trainer-dashboard-page.js";
import { renderTrainerSettingsPage } from "./trainer-settings-page.js";
import { renderWeeklyCheckinPage } from "./weekly-checkin-page.js";
import { renderMemberTodayPage } from "./member-today-page.js";
import { renderMemberProfilePage } from "./member-profile-page.js";
import { renderBetaControlPage } from "./beta-control-page.js";
import { renderAddMemberPage, renderEditMemberPage, renderPackagePage } from "./member-management-page.js";
import { renderMemberProgressPage } from "./member-progress-page.js";
import { renderMemberWeeklyUpdatePage } from "./member-weekly-update-page.js";
import { renderPackageManagement } from "./package-management.js";
import { restoreCoachSession } from "./coach-session.js";
import { renderNutritionPage } from "./nutrition-page.js";
import { renderTrainerNutritionPage } from "./trainer-nutrition-page.js";
import { renderMemberHistoryPage } from "./member-history-page.js";
import { renderMemberSchedulePage } from "./member-schedule-page.js";

registerRoute("/", renderLanding);
registerRoute("/trainer-login", renderTrainerLogin);
registerRoute("/member", renderMemberTodayPage);
registerRoute("/nutrition", renderNutritionPage);
registerRoute("/member-profile", renderMemberProfilePage);
registerRoute("/member-weekly", renderMemberWeeklyUpdatePage);
registerRoute("/beta-control", renderBetaControlPage);
registerRoute("/workout", renderWorkoutOverview);
registerRoute("/workout-complete", renderWorkoutComplete);
registerRoute("/trainer", renderTrainerDashboardPage);
registerRoute("/members", renderMembersPage);
registerRoute("/member-add", renderAddMemberPage);
registerRoute("/programs", renderProgramsPage);
registerRoute("/packages", renderPackageManagement);
registerRoute("/library", renderExerciseLibraryPage);
registerRoute("/trainer-settings", renderTrainerSettingsPage);
registerPatternRoute(/^\/workout-exercise-(\d+)$/, (index) => renderExerciseTracker(Number(index)));
registerPatternRoute(/^\/member-edit-([^/]+)$/, renderEditMemberPage);
registerPatternRoute(/^\/member-package-([^/]+)$/, renderPackagePage);
registerPatternRoute(/^\/member-progress-([^/]+)$/, renderMemberProgressPage);
registerPatternRoute(/^\/member-detail-([^/]+)$/, renderMemberDetail);
registerPatternRoute(/^\/trainer-nutrition-([^/]+)$/, renderTrainerNutritionPage);
registerPatternRoute(/^\/weekly-checkins-([^/]+)$/, renderWeeklyCheckinPage);
registerPatternRoute(/^\/progress-photos-([^/]+)$/, renderProgressPhotosPage);
registerPatternRoute(/^\/progress-([^/]+)$/, renderProgressPage);
registerPatternRoute(/^\/member-history-([^/]+)$/, renderMemberHistoryPage);
registerPatternRoute(/^\/member-schedule-([^/]+)$/, renderMemberSchedulePage);
registerPatternRoute(/^\/program-builder-(.+)$/, renderProgramBuilder);
registerRoute("/404", () => {
  const path = window.location.hash.replace(/^#/, "");

  const workoutMatch = path.match(/^\/workout-exercise-(\d+)$/);
  if (workoutMatch) {
    renderExerciseTracker(Number(workoutMatch[1]));
    return;
  }

  if (path === "/member-add") { renderAddMemberPage(); return; }

  const editMatch = path.match(/^\/member-edit-(\d{5})$/);
  if (editMatch) { renderEditMemberPage(editMatch[1]); return; }

  const pkgMatch = path.match(/^\/member-package-(\d{5})$/);
  if (pkgMatch) { renderPackagePage(pkgMatch[1]); return; }

  const mpMatch = path.match(/^\/member-progress-(\d{5})$/);
  if (mpMatch) { renderMemberProgressPage(mpMatch[1]); return; }

  const memberMatch = path.match(/^\/member-detail-(\d{5})$/);
  if (memberMatch) {
    renderMemberDetail(memberMatch[1]);
    return;
  }

  const trainerNutritionMatch = path.match(/^\/trainer-nutrition-(\d{5})$/);
  if (trainerNutritionMatch) {
    renderTrainerNutritionPage(trainerNutritionMatch[1]);
    return;
  }

  if (path === "/trainer-settings") {
    renderTrainerSettingsPage();
    return;
  }

  const weeklyCheckinMatch = path.match(/^\/weekly-checkins-(\d{5})$/);
  if (weeklyCheckinMatch) {
    renderWeeklyCheckinPage(weeklyCheckinMatch[1]);
    return;
  }

  const progressMatch = path.match(/^\/progress-(\d{5})$/);
  if (progressMatch) {
    renderProgressPage(progressMatch[1]);
    return;
  }

  const progressPhotosMatch = path.match(/^\/progress-photos-(\d{5})$/);
  if (progressPhotosMatch) {
    renderProgressPhotosPage(progressPhotosMatch[1]);
    return;
  }

  const programMatch = path.match(/^\/program-builder-(.+)$/);
  if (programMatch) {
    renderProgramBuilder(programMatch[1]);
    return;
  }

  renderNotFound();
});


function updateFirebaseBanner(detail) {
  const existing = document.querySelector("#global-firebase-banner");
  if (detail?.ready) {
    existing?.remove();
    return;
  }
  if (window.location.hash === "#/" || window.location.hash === "") return;
  const banner = existing || document.createElement("div");
  banner.id = "global-firebase-banner";
  banner.className = "global-firebase-banner";
  banner.setAttribute("role", "alert");
  banner.textContent = "เชื่อม Firebase ไม่สำเร็จ ข้อมูลที่เห็นอาจเป็นข้อมูลสำรองในเครื่อง กรุณาตรวจ Anonymous Authentication และ Firebase Rules ก่อนบันทึก";
  if (!existing) document.body.prepend(banner);
}

window.addEventListener("clob:firebase-status", (event) => updateFirebaseBanner(event.detail));
window.addEventListener("hashchange", () => {
  import("./firebase.js").then(({ getFirebaseStatus }) => updateFirebaseBanner(getFirebaseStatus()));
});

async function bootstrap() {
  restoreCoachSession();
  const firebaseStatus = await initializeFirebase();
  startRouter();
  updateFirebaseBanner(firebaseStatus);
}

bootstrap();

if ("serviceWorker" in navigator) {
  let reloadingForServiceWorker = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForServiceWorker) return;
    reloadingForServiceWorker = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js?v=hotfix-6", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  }, { once: true });
}


// Patch-003: prevent Safari page zoom while preserving normal vertical scrolling.
function installAppLikeTouchGuards() {
  const preventGesture = (event) => event.preventDefault();
  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, { passive: false });
  document.addEventListener("gestureend", preventGesture, { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) {
      lastTouchEnd = Date.now();
      return;
    }

    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener("wheel", (event) => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });
}

installAppLikeTouchGuards();

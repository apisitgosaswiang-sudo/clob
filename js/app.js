import { initializeFirebase } from "./firebase.js";
import { registerRoute, startRouter } from "./router.js";
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
import { renderTrainerDashboard } from "./trainer-dashboard.js";
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

registerRoute("/", renderLanding);
registerRoute("/trainer-login", renderTrainerLogin);
registerRoute("/member", renderMemberTodayPage);
registerRoute("/member-profile", renderMemberProfilePage);
registerRoute("/member-weekly", renderMemberWeeklyUpdatePage);
registerRoute("/beta-control", renderBetaControlPage);
registerRoute("/workout", renderWorkoutOverview);
registerRoute("/workout-complete", renderWorkoutComplete);
registerRoute("/trainer", renderTrainerDashboardPage);
registerRoute("/members", renderMembersPage);
registerRoute("/programs", renderProgramsPage);
registerRoute("/library", renderExerciseLibraryPage);
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

async function bootstrap() {
  await initializeFirebase();
  startRouter();
}

bootstrap();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

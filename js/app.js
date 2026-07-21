import { initializeFirebase } from "./firebase.js";
import { registerRoute, startRouter } from "./router.js";
import {
  renderLanding,
  renderTrainerLogin,
  renderMemberDashboard,
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

registerRoute("/", renderLanding);
registerRoute("/trainer-login", renderTrainerLogin);
registerRoute("/member", renderMemberDashboard);
registerRoute("/workout", renderWorkoutOverview);
registerRoute("/workout-complete", renderWorkoutComplete);
registerRoute("/trainer", renderTrainerDashboard);
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

  const memberMatch = path.match(/^\/member-detail-(\d{5})$/);
  if (memberMatch) {
    renderMemberDetail(memberMatch[1]);
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

startRouter();
initializeFirebase();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

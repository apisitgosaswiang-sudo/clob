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

registerRoute("/", renderLanding);
registerRoute("/trainer-login", renderTrainerLogin);
registerRoute("/member", renderMemberDashboard);
registerRoute("/workout", renderWorkoutOverview);
registerRoute("/workout-complete", renderWorkoutComplete);
registerRoute("/trainer", renderTrainerDashboard);
registerRoute("/members", renderMembersPage);
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

import { initializeFirebase } from "./firebase.js";
import { registerRoute, startRouter } from "./router.js";
import {
  renderLanding,
  renderTrainerLogin,
  renderMemberDashboard,
  renderTrainerPlaceholder,
  renderNotFound
} from "./views.js";
import {
  renderWorkoutOverview,
  renderExerciseTracker,
  renderWorkoutComplete
} from "./workout.js";

registerRoute("/", renderLanding);
registerRoute("/trainer-login", renderTrainerLogin);
registerRoute("/member", renderMemberDashboard);
registerRoute("/workout", renderWorkoutOverview);
registerRoute("/workout-complete", renderWorkoutComplete);
registerRoute("/trainer", renderTrainerPlaceholder);
registerRoute("/404", () => {
  const path = window.location.hash.replace(/^#/, "");
  const match = path.match(/^\/workout-exercise-(\d+)$/);

  if (match) {
    renderExerciseTracker(Number(match[1]));
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

import { navigate } from "./router.js";
import { getTrainerProfile, saveTrainerProfile } from "./trainer-profile.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");

export function renderTrainerSettingsPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const profile = getTrainerProfile();

  app.innerHTML = `
    <main class="page trainer-page">
      <div class="trainer-settings-screen">
        <header class="trainer-settings-header">
          <button id="settings-back" class="back-button">←</button>
          <div>
            <p class="section-label">ACCOUNT</p>
            <h1>Trainer Profile</h1>
          </div>
        </header>

        <section class="trainer-profile-preview card">
          ${renderAvatar({
            name: profile.name,
            photoUrl: profile.profilePhoto,
            className: "trainer-settings-avatar"
          })}
          <div>
            <strong>Coach ${escapeHtml(profile.name)}</strong>
            <span>Avatar uses the first letter of your name.</span>
          </div>
        </section>

        <form id="trainer-profile-form" class="trainer-profile-form card">
          <label>
            <span>Coach Name</span>
            <input name="name" value="${escapeHtml(profile.name)}" required maxlength="40">
          </label>

          <label>
            <span>Profile Photo URL</span>
            <input name="profilePhoto" value="${escapeHtml(profile.profilePhoto || "")}" placeholder="Optional">
          </label>

          <label>
            <span>Email</span>
            <input name="email" type="email" value="${escapeHtml(profile.email || "")}" placeholder="Optional">
          </label>

          <button class="button button-primary" type="submit">Save Profile</button>
          <button id="open-beta-control" class="button button-secondary" type="button">Beta Control & Data Backup</button>
        </form>

        <div id="settings-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  document.querySelector("#settings-back").addEventListener("click", () => navigate("/trainer"));

  document.querySelector("#open-beta-control").addEventListener("click", () => navigate("/beta-control"));

  document.querySelector("#trainer-profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveTrainerProfile({
      name: String(data.get("name")).trim(),
      profilePhoto: String(data.get("profilePhoto")).trim(),
      email: String(data.get("email")).trim()
    });

    showToast("Saved");
    setTimeout(() => renderTrainerSettingsPage(), 400);
  });
}

function showToast(message) {
  const toast = document.querySelector("#settings-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 1600);
}

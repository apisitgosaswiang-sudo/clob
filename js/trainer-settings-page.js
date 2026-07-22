import { APP_CONFIG } from "./config.js";
import { navigate } from "./router.js";
import { loadTrainerProfile, saveTrainerProfile } from "./trainer-profile.js";
import { uploadImage, saveCoachProfilePhoto } from "./firebase.js";
import { createImageCropper } from "./image-processor.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");
let cropper = null;
let selectedFile = null;

export async function renderTrainerSettingsPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const profile = await loadTrainerProfile();

  app.innerHTML = `
    <main class="page trainer-page">
      <div class="trainer-settings-screen">
        <header class="trainer-settings-header">
          <button id="settings-back" class="back-button">←</button>
          <div>
            <p class="section-label">ACCOUNT</p>
            <h1>Coach Profile</h1>
          </div>
        </header>

        <section class="trainer-profile-preview card">
          <button id="coach-photo-button" class="coach-photo-button" type="button" aria-label="เปลี่ยนรูปโปรไฟล์">
            ${renderAvatar({
              name: profile.name,
              photoUrl: profile.profilePhoto,
              className: "trainer-settings-avatar"
            })}
            <span class="coach-photo-edit">✎</span>
          </button>
          <div>
            <strong>Coach ${escapeHtml(profile.name)}</strong>
            <span>${escapeHtml(profile.role || "Master Coach")} · ID ${escapeHtml(APP_CONFIG.coachId)}</span>
            <button id="coach-photo-text-button" class="profile-photo-link" type="button">เพิ่มหรือเปลี่ยนรูป</button>
          </div>
        </section>

        <input id="coach-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>

        <form id="trainer-profile-form" class="trainer-profile-form card">
          <label>
            <span>Coach Name</span>
            <input name="name" value="${escapeHtml(profile.name)}" required maxlength="40">
          </label>

          <label>
            <span>Email</span>
            <input name="email" type="email" value="${escapeHtml(profile.email || "")}" placeholder="Optional">
          </label>

          <button class="button button-primary" type="submit">Save Profile</button>
          <div class="settings-compact-row">
            <div><strong>Packages</strong><span>สร้างหรือปรับแพ็กเกจสำหรับสมาชิก</span></div>
            <button id="open-packages" class="compact-action" type="button">จัดการ</button>
          </div>
          <button id="open-beta-control" class="button button-secondary" type="button">Beta Control & Data Backup</button>
          <button id="trainer-home" class="button button-secondary" type="button">กลับหน้า Home หลัก</button>
          <button id="trainer-logout" class="button button-text" type="button">ออกจากระบบ Coach</button>
        </form>

        <nav class="bottom-nav trainer-bottom-nav" aria-label="เมนูเทรนเนอร์">
          <button class="nav-item" data-route="/trainer"><span>⌂</span><small>Dashboard</small></button>
          <button class="nav-item" data-route="/members"><span>👥</span><small>Members</small></button>
          <button class="nav-item" data-route="/programs"><span>▤</span><small>Programs</small></button>
          <button class="nav-item" data-route="/library"><span>✦</span><small>Library</small></button>
          <button class="nav-item is-active" data-route="/trainer-settings"><span>⚙</span><small>Settings</small></button>
        </nav>

        <div id="coach-crop-modal" class="builder-modal" hidden></div>
        <div id="coach-upload-modal" class="builder-modal" hidden></div>
        <div id="settings-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  bind(profile);
}

function bind(profile) {
  document.querySelector("#settings-back").addEventListener("click", () => navigate("/trainer"));
  document.querySelector("#open-packages").addEventListener("click", () => navigate("/packages"));
  document.querySelector("#open-beta-control").addEventListener("click", () => navigate("/beta-control"));
  document.querySelector("#trainer-home").addEventListener("click", () => navigate("/"));
  document.querySelector("#trainer-logout").addEventListener("click", () => {
    sessionStorage.removeItem("clob_trainer");
    sessionStorage.removeItem("clob_coach_id");
    navigate("/");
  });
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });

  const input = document.querySelector("#coach-photo-input");
  const choosePhoto = () => input.click();
  document.querySelector("#coach-photo-button").addEventListener("click", choosePhoto);
  document.querySelector("#coach-photo-text-button").addEventListener("click", choosePhoto);

  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      showToast("ไฟล์ใหญ่เกิน 12 MB");
      return;
    }
    selectedFile = file;
    openCropModal(profile);
  });

  document.querySelector("#trainer-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const data = new FormData(event.currentTarget);
    button.disabled = true;
    button.textContent = "Saving...";
    try {
      await saveTrainerProfile({
        name: String(data.get("name")).trim(),
        email: String(data.get("email")).trim()
      });
      showToast("Saved");
      setTimeout(() => renderTrainerSettingsPage(), 400);
    } catch {
      showToast("บันทึกไม่สำเร็จ");
      button.disabled = false;
      button.textContent = "Save Profile";
    }
  });
}

function openCropModal(profile) {
  const modal = document.querySelector("#coach-crop-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card crop-card">
      <div class="builder-modal-head">
        <div><p class="section-label">PROFILE PHOTO</p><h2>Crop Photo</h2></div>
        <button id="coach-crop-close" type="button">×</button>
      </div>
      <div class="crop-stage">
        <canvas id="coach-crop-canvas" width="720" height="900"></canvas>
        <div class="crop-guide"></div>
      </div>
      <label class="crop-zoom"><span>Zoom</span><input id="coach-crop-zoom" type="range" min="1" max="2.5" step="0.01" value="1"></label>
      <div class="crop-actions">
        <button id="coach-crop-change" class="button button-secondary" type="button">Change</button>
        <button id="coach-crop-use" class="button button-primary" type="button">Use Photo</button>
      </div>
    </div>
  `;

  cropper = createImageCropper({
    file: selectedFile,
    canvas: document.querySelector("#coach-crop-canvas"),
    zoomInput: document.querySelector("#coach-crop-zoom")
  });

  const close = () => {
    cropper?.destroy();
    cropper = null;
    modal.hidden = true;
  };

  document.querySelector("#coach-crop-close").addEventListener("click", close);
  document.querySelector("#coach-crop-change").addEventListener("click", () => {
    close();
    document.querySelector("#coach-photo-input").click();
  });
  document.querySelector("#coach-crop-use").addEventListener("click", async () => {
    const button = document.querySelector("#coach-crop-use");
    button.disabled = true;
    button.textContent = "Processing...";
    try {
      const result = await cropper.toWebP();
      close();
      await uploadCoachPhoto(profile, result);
    } catch {
      button.disabled = false;
      button.textContent = "Use Photo";
      showToast("ไม่สามารถประมวลผลรูปได้");
    }
  });
}

async function uploadCoachPhoto(profile, result) {
  const modal = document.querySelector("#coach-upload-modal");
  modal.hidden = false;
  modal.innerHTML = uploadMarkup(0);

  try {
    const upload = await uploadImage(
      `coaches/${APP_CONFIG.coachId}/profile/profile_${Date.now()}.webp`,
      result.blob,
      updateUploadProgress
    );
    const saved = await saveCoachProfilePhoto(APP_CONFIG.coachId, upload);
    if (!saved) throw new Error("บันทึกรูปโปรไฟล์ไม่สำเร็จ");
    await saveTrainerProfile({ ...profile, profilePhoto: upload.url });
    URL.revokeObjectURL(result.previewUrl);
    modal.hidden = true;
    showToast("อัปเดตรูปแล้ว");
    setTimeout(() => renderTrainerSettingsPage(), 350);
  } catch (error) {
    modal.innerHTML = `
      <div class="builder-modal-card upload-state-card">
        <p class="section-label">UPLOAD FAILED</p>
        <h2>ลองอีกครั้ง</h2>
        <p>${escapeHtml(error?.message || "Upload failed")}</p>
        <button id="coach-upload-close" class="button button-secondary" type="button">ปิด</button>
      </div>
    `;
    document.querySelector("#coach-upload-close").addEventListener("click", () => { modal.hidden = true; });
  }
}

function uploadMarkup(progress) {
  return `
    <div class="builder-modal-card upload-state-card">
      <p class="section-label">UPLOAD</p>
      <h2>Uploading profile...</h2>
      <div class="upload-progress-track"><div id="coach-upload-progress-bar" style="width:${progress}%"></div></div>
      <strong id="coach-upload-progress-label">${progress}%</strong>
    </div>
  `;
}

function updateUploadProgress(progress) {
  const bar = document.querySelector("#coach-upload-progress-bar");
  const label = document.querySelector("#coach-upload-progress-label");
  if (bar) bar.style.width = `${progress}%`;
  if (label) label.textContent = `${progress}%`;
}

function showToast(message) {
  const toast = document.querySelector("#settings-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 1600);
}

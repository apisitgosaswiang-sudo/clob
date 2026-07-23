import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import { uploadImage, saveProgressPhotoSet, getProgressPhotoSets } from "./firebase.js";
import { uploadProfilePhoto } from "./profile-photo-service.js";
import { createImageCropper } from "./image-processor.js";

const app = document.querySelector("#app");
const slots = ["front", "side", "back"];
let member = null;
let pending = {};
let activeSlot = null;
let activeFile = null;
let cropper = null;
let isTrainerView = false;
let savedPhotoSets = {};

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  }).format(new Date());
}

function createId() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}-${Date.now().toString(36)}`;
}

export async function renderProgressPhotosPage(code) {
  const trainerLoggedIn = sessionStorage.getItem("clob_trainer") === "true";
  const memberCode = sessionStorage.getItem("clob_member_code");
  isTrainerView = trainerLoggedIn;
  if (!trainerLoggedIn && memberCode !== code) { navigate("/"); return; }

  const members = await loadMembers();
  member = getMemberByCode(members, code);
  if (!member) {
    navigate("/members");
    return;
  }

  pending = {};
  savedPhotoSets = filterPhotoSets(await getProgressPhotoSets(code));
  render();
}

function render() {
  app.innerHTML = `
    <main class="page trainer-page">
      <div class="progress-photo-screen">
        <header class="progress-photo-header">
          <button id="progress-back" class="back-button">←</button>
          <div>
            <p class="section-label">PROGRESS</p>
            <h1>Photos</h1>
          </div>
          <span>${todayLabel()}</span>
        </header>

        <section class="progress-member-card card">
          <div class="progress-member-avatar">
            ${member.profilePhoto
              ? `<img src="${esc(member.profilePhoto)}" alt="">`
              : esc(member.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <strong>${esc(member.name)}</strong>
            <span>${esc(member.code)}</span>
          </div>
          ${isTrainerView ? "" : `<button id="profile-photo-button">Profile Photo</button>`}
        </section>

        <section class="progress-photo-intro">
          <h2>Progress Photos</h2>
          <p>${isTrainerView ? "ดูรูปที่สมาชิกอัปโหลดมาแบบ Read-only" : "Select, crop, then confirm. Upload starts only after Save Photos."}</p>
        </section>

        ${isTrainerView ? trainerGalleryMarkup() : `<section class="progress-photo-grid">${slots.map((slot) => slotMarkup(slot)).join("")}</section>`}

        ${isTrainerView ? "" : `<section class="photo-privacy card"><span>Private</span><p>สมาชิกเป็นผู้จัดการรูปของตนเอง</p></section>`}

        ${isTrainerView ? "" : `<button id="save-photos" class="button button-primary progress-save" ${Object.keys(pending).length ? "" : "disabled"}>Save Photos</button>`}

        ${isTrainerView ? "" : `<input id="progress-file-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>`}
        <div id="crop-modal" class="builder-modal" hidden></div>
        <div id="upload-modal" class="builder-modal" hidden></div>
        <div id="progress-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  bind();
}

function trainerGalleryMarkup() {
  const sets = Object.values(savedPhotoSets || {}).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  if (!sets.length) return `<section class="photo-readonly-empty card"><strong>สมาชิกยังไม่ได้อัปโหลดรูป</strong><p>เมื่อสมาชิกบันทึกรูปแล้ว รูปจะปรากฏที่นี่</p></section>`;
  return `<section class="trainer-photo-history">${sets.map(set=>`<article class="trainer-photo-set card"><strong>${new Date(set.createdAt||Date.now()).toLocaleDateString("th-TH")}</strong><div class="progress-photo-grid readonly">${slots.map(slot=>{const x=set.photos?.[slot];return `<figure class="readonly-photo">${x?.url?`<a href="${esc(x.url)}" target="_blank"><img src="${esc(x.url)}" alt="${slot}"></a>`:`<div class="photo-missing">${slot}</div>`}<figcaption>${slot}</figcaption></figure>`;}).join("")}</div></article>`).join("")}</section>`;
}

function filterPhotoSets(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => {
      return Object.values(item?.photos || {}).some((photo) => Boolean(photo?.url));
    })
  );
}

function slotMarkup(slot) {
  const value = pending[slot];
  const title = slot.charAt(0).toUpperCase() + slot.slice(1);
  return `
    <article class="progress-photo-slot ${value ? "has-image" : ""}">
      <button data-photo-slot="${slot}" aria-label="${title}">
        ${value
          ? `<img src="${value.previewUrl}" alt="${title} preview">`
          : `<span class="photo-slot-icon">＋</span><strong>${title}</strong><small>Add Photo</small>`}
      </button>
      ${value ? `<button class="photo-replace" data-photo-slot="${slot}">Replace</button>` : ""}
      ${value ? `<span class="photo-pending">Pending</span>` : ""}
    </article>
  `;
}

function bind() {
  document.querySelector("#progress-back").addEventListener("click", () => { navigate(isTrainerView ? `/progress-${member.code}` : `/member-progress-${member.code}`); });
  if (isTrainerView) return;

  document.querySelectorAll("[data-photo-slot]").forEach((button) => {
    button.addEventListener("click", () => chooseFile(button.dataset.photoSlot));
  });

  document.querySelector("#profile-photo-button").addEventListener("click", () => {
    chooseFile("profile");
  });

  document.querySelector("#progress-file-input").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast("File too large");
      return;
    }
    activeFile = file;
    openCropModal();
  });

  document.querySelector("#save-photos").addEventListener("click", confirmUpload);
}

function chooseFile(slot) {
  activeSlot = slot;
  document.querySelector("#progress-file-input").click();
}

function openCropModal() {
  const modal = document.querySelector("#crop-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card crop-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">CROP 4:5</p>
          <h2>${activeSlot === "profile" ? "Profile Photo" : `${activeSlot[0].toUpperCase() + activeSlot.slice(1)} Photo`}</h2>
        </div>
        <button id="crop-close">×</button>
      </div>

      <div class="crop-stage">
        <canvas id="crop-canvas" width="720" height="900"></canvas>
        <div class="crop-guide"></div>
      </div>

      <label class="crop-zoom">
        <span>Zoom</span>
        <input id="crop-zoom" type="range" min="1" max="2.5" step="0.01" value="1">
      </label>

      <div class="crop-actions">
        <button id="crop-change" class="button button-secondary">Change</button>
        <button id="crop-use" class="button button-primary">Use Photo</button>
      </div>
    </div>
  `;

  const canvas = document.querySelector("#crop-canvas");
  const zoom = document.querySelector("#crop-zoom");
  cropper = createImageCropper({ file: activeFile, canvas, zoomInput: zoom });

  const close = () => {
    cropper?.destroy();
    cropper = null;
    modal.hidden = true;
  };

  document.querySelector("#crop-close").addEventListener("click", close);
  document.querySelector("#crop-change").addEventListener("click", () => {
    close();
    chooseFile(activeSlot);
  });

  document.querySelector("#crop-use").addEventListener("click", async () => {
    const button = document.querySelector("#crop-use");
    button.disabled = true;
    button.textContent = "Processing...";
    try {
      const result = await cropper.toWebP();
      if (activeSlot === "profile") {
        await uploadProfile(result);
        close();
      } else {
        pending[activeSlot] = result;
        close();
        render();
        toast("Photo ready");
      }
    } catch (error) {
      button.disabled = false;
      button.textContent = "Use Photo";
      toast("Could not process");
    }
  });
}

async function uploadProfile(result) {
  const modal = document.querySelector("#upload-modal");
  modal.hidden = false;
  modal.innerHTML = uploadMarkup("Uploading profile...", 0);

  try {
    const upload = await uploadProfilePhoto({
      ownerType: "member",
      ownerId: member.code,
      blob: result.blob,
      onProgress: (progress) => updateUploadProgress(progress)
    });
    member.profilePhoto = upload.url;
    modal.hidden = true;
    render();
    toast("Saved");
  } catch (error) {
    showUploadError(error, () => uploadProfile(result));
  }
}

function confirmUpload() {
  const count = Object.keys(pending).length;
  if (!count) return;

  const modal = document.querySelector("#upload-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card upload-confirm-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">CONFIRM</p>
          <h2>Upload ${count} Photo${count > 1 ? "s" : ""}?</h2>
        </div>
        <button id="upload-confirm-close">×</button>
      </div>
      <p>Check each photo before upload.</p>
      <div class="upload-confirm-preview">
        ${Object.entries(pending).map(([slot, value]) => `
          <figure><img src="${value.previewUrl}" alt=""><figcaption>${slot}</figcaption></figure>
        `).join("")}
      </div>
      <div class="crop-actions">
        <button id="upload-cancel" class="button button-secondary">Cancel</button>
        <button id="upload-start" class="button button-primary">Upload</button>
      </div>
    </div>
  `;

  const close = () => { modal.hidden = true; };
  document.querySelector("#upload-confirm-close").addEventListener("click", close);
  document.querySelector("#upload-cancel").addEventListener("click", close);
  document.querySelector("#upload-start").addEventListener("click", uploadAll);
}

async function uploadAll() {
  const modal = document.querySelector("#upload-modal");
  const entries = Object.entries(pending);
  const checkinId = createId();
  const uploaded = {};

  modal.innerHTML = uploadMarkup("Uploading photos...", 0);

  try {
    for (let index = 0; index < entries.length; index += 1) {
      const [slot, value] = entries[index];
      const extension = value.blob.type === "image/jpeg"
        ? "jpg"
        : value.blob.type === "image/png" ? "png" : "webp";
      const filename = `${slot}_${Date.now()}_${index}.${extension}`;
      const result = await uploadImage(
        `members/${member.code}/checkins/${checkinId}/${filename}`,
        value.blob,
        (itemProgress) => {
          const total = Math.round(((index + itemProgress / 100) / entries.length) * 100);
          updateUploadProgress(total);
        }
      );
      uploaded[slot] = result;
    }

    const metadataSaved = await saveProgressPhotoSet(member.code, checkinId, {
      id: checkinId,
      createdAt: Date.now(),
      createdDate: new Date().toISOString(),
      photos: uploaded
    });
    if (!metadataSaved) {
      throw new Error("อัปโหลดรูปแล้ว แต่บันทึกข้อมูลรูปลง Firebase ไม่สำเร็จ");
    }

    Object.values(pending).forEach((value) => URL.revokeObjectURL(value.previewUrl));
    pending = {};
    modal.hidden = true;
    render();
    toast("Uploaded");
  } catch (error) {
    showUploadError(error, uploadAll);
  }
}

function uploadMarkup(title, progress) {
  return `
    <div class="builder-modal-card upload-state-card">
      <p class="section-label">UPLOAD</p>
      <h2>${title}</h2>
      <div class="upload-progress-track"><div id="upload-progress-bar" style="width:${progress}%"></div></div>
      <strong id="upload-progress-label">${progress}%</strong>
    </div>
  `;
}

function updateUploadProgress(progress) {
  const bar = document.querySelector("#upload-progress-bar");
  const label = document.querySelector("#upload-progress-label");
  if (bar) bar.style.width = `${progress}%`;
  if (label) label.textContent = `${progress}%`;
}

function showUploadError(error, retry) {
  const modal = document.querySelector("#upload-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card upload-state-card">
      <p class="section-label">UPLOAD FAILED</p>
      <h2>Try again</h2>
      <p>${esc(error?.message || "Upload failed.")}</p>
      <div class="crop-actions">
        <button id="upload-error-cancel" class="button button-secondary">Cancel</button>
        <button id="upload-error-retry" class="button button-primary">Retry</button>
      </div>
    </div>
  `;
  document.querySelector("#upload-error-cancel").addEventListener("click", () => modal.hidden = true);
  document.querySelector("#upload-error-retry").addEventListener("click", retry);
}

function toast(message) {
  const el = document.querySelector("#progress-toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 1900);
}

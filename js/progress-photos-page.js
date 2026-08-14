import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import { uploadImage, saveProgressPhotoSet, getProgressPhotoSets, deleteProgressPhotoSet, deleteStoredImage, waitForFirebaseReady } from "./firebase.js";
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
let pendingMetadataRetry = null;
let editingSetId = null;
let editPending = {};
let editRemoved = new Set();
let editUploadedCache = {};
let activeContext = "new";

function pendingPhotoStorageKey(memberCode) {
  return `clob_pending_progress_photos_${String(memberCode || "").trim()}`;
}

function loadPendingPhotoSets(memberCode) {
  try {
    return JSON.parse(localStorage.getItem(pendingPhotoStorageKey(memberCode)) || "{}");
  } catch {
    return {};
  }
}

function savePendingPhotoSets(memberCode, value) {
  try {
    const key = pendingPhotoStorageKey(memberCode);
    const normalized = value && typeof value === "object" ? value : {};
    if (Object.keys(normalized).length) localStorage.setItem(key, JSON.stringify(normalized));
    else localStorage.removeItem(key);
  } catch (error) {
    console.warn("Could not cache pending progress photos:", error);
  }
}

function queuePendingPhotoSet(memberCode, checkinId, payload) {
  const queued = loadPendingPhotoSets(memberCode);
  queued[checkinId] = payload;
  savePendingPhotoSets(memberCode, queued);
}

async function flushPendingPhotoSets(memberCode) {
  const queued = loadPendingPhotoSets(memberCode);
  const ids = Object.keys(queued);
  if (!ids.length) return true;

  for (const checkinId of ids) {
    const saved = await saveProgressPhotoSet(memberCode, checkinId, queued[checkinId]);
    if (!saved) return false;
    delete queued[checkinId];
    savePendingPhotoSets(memberCode, queued);
  }
  return true;
}

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
  savedPhotoSets = {};
  editingSetId = null;
  editPending = {};
  editRemoved = new Set();
  editUploadedCache = {};
  activeContext = "new";

  // The app renders before Firebase initializes. Wait briefly here so a direct
  // visit to Progress Photos does not incorrectly show an empty history or let
  // the first upload race Anonymous Auth / Storage initialization.
  const firebaseReady = await waitForFirebaseReady(8000);
  if (firebaseReady) {
    await flushPendingPhotoSets(code);
    savedPhotoSets = filterPhotoSets(await getProgressPhotoSets(code));
  }

  render();
  if (!firebaseReady) {
    toast("Firebase ยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่");
  }
}

let compareA = "";
let compareB = "";

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

        ${isTrainerView ? compareMarkup() : ""}

        ${isTrainerView ? trainerGalleryMarkup() : `<section class="progress-photo-grid">${slots.map((slot) => slotMarkup(slot)).join("")}</section>${memberGalleryMarkup()}`}

        ${isTrainerView ? "" : `<section class="photo-privacy card"><span>Private</span><p>สมาชิกเป็นผู้จัดการรูปของตนเอง</p></section>`}

        ${isTrainerView ? "" : `<button id="save-photos" class="button button-primary progress-save" ${Object.keys(pending).length ? "" : "disabled"}>Save Photos</button>`}

        ${isTrainerView ? "" : `<input id="progress-file-input" type="file" accept="image/*" hidden>`}
        <div id="crop-modal" class="builder-modal" hidden></div>
        <div id="upload-modal" class="builder-modal" hidden></div>
        <div id="progress-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  bind();
}

// โหมดเทียบรูป 2 วัน วางคู่กัน (before/after)
function compareMarkup() {
  const sets = Object.values(savedPhotoSets || {})
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  if (sets.length < 2) return "";

  const options = (selected) => sets.map((set) => {
    const key = String(set.createdAt || set.id || "");
    const label = new Date(Number(set.createdAt || Date.now())).toLocaleDateString("th-TH", { dateStyle: "medium" });
    return `<option value="${esc(key)}" ${String(selected) === key ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");

  const keyOf = (set) => String(set.createdAt || set.id || "");
  const first = compareA || keyOf(sets[0]);
  const last = compareB || keyOf(sets[sets.length - 1]);
  const setA = sets.find((set) => keyOf(set) === first) || sets[0];
  const setB = sets.find((set) => keyOf(set) === last) || sets[sets.length - 1];

  return `
    <section class="photo-compare card">
      <div class="photo-compare-head">
        <strong>เทียบก่อน–หลัง</strong>
        <span>${sets.length} ชุดรูป</span>
      </div>
      <div class="photo-compare-controls">
        <label><span>ก่อน</span><select id="compare-a">${options(first)}</select></label>
        <label><span>หลัง</span><select id="compare-b">${options(last)}</select></label>
      </div>
      <div class="photo-compare-rows">
        ${slots.map((slot) => {
          const a = setA?.photos?.[slot]?.url;
          const b = setB?.photos?.[slot]?.url;
          if (!a && !b) return "";
          return `
            <div class="photo-compare-row">
              <p>${esc(slot)}</p>
              <div class="photo-compare-pair">
                <figure>${a ? `<img src="${esc(a)}" alt="ก่อน ${esc(slot)}">` : `<div class="photo-missing">ไม่มีรูป</div>`}<figcaption>ก่อน</figcaption></figure>
                <figure>${b ? `<img src="${esc(b)}" alt="หลัง ${esc(slot)}">` : `<div class="photo-missing">ไม่มีรูป</div>`}<figcaption>หลัง</figcaption></figure>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function trainerGalleryMarkup() {
  const sets = Object.values(savedPhotoSets || {}).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  if (!sets.length) return `<section class="photo-readonly-empty card"><strong>สมาชิกยังไม่ได้อัปโหลดรูป</strong><p>เมื่อสมาชิกบันทึกรูปแล้ว รูปจะปรากฏที่นี่</p></section>`;
  return `<section class="trainer-photo-history">${sets.map(set=>`<article class="trainer-photo-set card"><strong>${new Date(set.createdAt||Date.now()).toLocaleDateString("th-TH")}</strong><div class="progress-photo-grid readonly">${slots.map(slot=>{const x=set.photos?.[slot];return `<figure class="readonly-photo">${x?.url?`<a href="${esc(x.url)}" target="_blank"><img src="${esc(x.url)}" alt="${slot}"></a>`:`<div class="photo-missing">${slot}</div>`}<figcaption>${slot}</figcaption></figure>`;}).join("")}</div></article>`).join("")}</section>`;
}

function memberGalleryMarkup() {
  const sets = Object.entries(savedPhotoSets || {})
    .map(([key, set]) => ({ key, set }))
    .sort((a, b) => Number(b.set?.createdAt || 0) - Number(a.set?.createdAt || 0));
  if (!sets.length) return "";

  return `
    <section class="member-photo-history">
      <div class="member-photo-history-head">
        <strong>Saved Photos</strong>
        <span>${sets.length} ชุด</span>
      </div>
      ${sets.map(({ key, set }) => memberPhotoSetMarkup(set, key)).join("")}
    </section>
  `;
}

function memberPhotoSetMarkup(set, key) {
  const setId = String(key || set.id || "");
  const editing = editingSetId === setId;
  const label = new Date(set.createdAt || Date.now()).toLocaleDateString("th-TH");

  if (!editing) {
    return `
      <article class="member-photo-set card">
        <div class="member-photo-set-head">
          <strong>${esc(label)}</strong>
          <div class="member-photo-actions">
            <button type="button" data-photo-edit="${esc(setId)}">แก้ไข</button>
            <button type="button" class="danger" data-photo-delete="${esc(setId)}">ลบ</button>
          </div>
        </div>
        <div class="progress-photo-grid readonly">
          ${slots.map((slot) => {
            const photo = set.photos?.[slot];
            return `<figure class="readonly-photo">${photo?.url ? `<img src="${esc(photo.url)}" alt="${slot}">` : `<div class="photo-missing">${slot}</div>`}<figcaption>${slot}</figcaption></figure>`;
          }).join("")}
        </div>
      </article>
    `;
  }

  return `
    <article class="member-photo-set card editing">
      <div class="member-photo-set-head">
        <div><strong>${esc(label)}</strong><small>แตะ Replace เพื่อเปลี่ยนรูป หรือ Remove เพื่อลบรูปช่องนั้น</small></div>
      </div>
      <div class="progress-photo-grid readonly edit-photo-grid">
        ${slots.map((slot) => {
          const replacement = editPending[slot];
          const original = set.photos?.[slot];
          const removed = editRemoved.has(slot);
          const url = replacement?.previewUrl || (!removed ? original?.url : "");
          return `
            <figure class="readonly-photo edit-photo-slot">
              ${url ? `<img src="${esc(url)}" alt="${slot}">` : `<div class="photo-missing">${slot}</div>`}
              <figcaption>${slot}</figcaption>
              <button type="button" data-edit-replace="${slot}">Replace</button>
              ${url ? `<button type="button" class="danger-link" data-edit-remove="${slot}">Remove</button>` : ""}
            </figure>
          `;
        }).join("")}
      </div>
      <div class="member-photo-edit-actions">
        <button type="button" class="button button-secondary" id="photo-edit-cancel">Cancel</button>
        <button type="button" class="button button-primary" id="photo-edit-save">Save Changes</button>
      </div>
    </article>
  `;
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

  document.querySelector("#compare-a")?.addEventListener("change", (event) => {
    compareA = event.target.value;
    render();
  });
  document.querySelector("#compare-b")?.addEventListener("change", (event) => {
    compareB = event.target.value;
    render();
  });

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

  document.querySelectorAll("[data-photo-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editingSetId = button.dataset.photoEdit;
      editPending = {};
      editRemoved = new Set();
      editUploadedCache = {};
      render();
    });
  });

  document.querySelectorAll("[data-photo-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteSavedSet(button.dataset.photoDelete));
  });

  document.querySelectorAll("[data-edit-replace]").forEach((button) => {
    button.addEventListener("click", () => chooseFile(button.dataset.editReplace, "edit"));
  });

  document.querySelectorAll("[data-edit-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.dataset.editRemove;
      if (editPending[slot]?.previewUrl) URL.revokeObjectURL(editPending[slot].previewUrl);
      delete editPending[slot];
      delete editUploadedCache[slot];
      editRemoved.add(slot);
      render();
    });
  });

  document.querySelector("#photo-edit-cancel")?.addEventListener("click", cancelPhotoEdit);
  document.querySelector("#photo-edit-save")?.addEventListener("click", saveEditedSet);

  document.querySelector("#save-photos").addEventListener("click", confirmUpload);
}

function cancelPhotoEdit() {
  Object.values(editPending).forEach((value) => {
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
  });
  editingSetId = null;
  editPending = {};
  editRemoved = new Set();
  editUploadedCache = {};
  activeContext = "new";
  render();
}

async function deleteSavedSet(setId) {
  const set = savedPhotoSets?.[setId];
  if (!set) return;
  if (!window.confirm("ลบชุดรูปนี้ใช่ไหม? การลบไม่สามารถย้อนกลับได้")) return;

  const ready = await waitForFirebaseReady(8000);
  if (!ready) { toast("Firebase ยังไม่พร้อม กรุณาลองใหม่"); return; }

  const deleted = await deleteProgressPhotoSet(member.code, setId, set);
  if (!deleted) { toast("ลบรูปไม่สำเร็จ กรุณาลองใหม่"); return; }

  delete savedPhotoSets[setId];
  if (editingSetId === setId) cancelPhotoEdit();
  else render();
  toast("Deleted");
}

async function saveEditedSet() {
  const set = savedPhotoSets?.[editingSetId];
  if (!set) return;
  if (!Object.keys(editPending).length && !editRemoved.size) {
    cancelPhotoEdit();
    return;
  }

  const button = document.querySelector("#photo-edit-save");
  if (button) { button.disabled = true; button.textContent = "Saving..."; }

  try {
    const ready = await waitForFirebaseReady(8000);
    if (!ready) throw new Error("Firebase ยังไม่พร้อม กรุณาลองใหม่");

    const nextPhotos = { ...(set.photos || {}) };
    const oldPathsToDelete = [];

    for (const slot of editRemoved) {
      if (nextPhotos[slot]?.fullPath) oldPathsToDelete.push(nextPhotos[slot].fullPath);
      delete nextPhotos[slot];
    }

    for (const [slot, value] of Object.entries(editPending)) {
      let uploaded = editUploadedCache[slot];
      if (!uploaded) {
        const extension = value.blob.type === "image/jpeg" ? "jpg" : value.blob.type === "image/png" ? "png" : "webp";
        uploaded = await uploadImage(
          `members/${member.code}/checkins/${editingSetId}/${slot}_${Date.now()}.${extension}`,
          value.blob
        );
        editUploadedCache[slot] = uploaded;
      }
      if (nextPhotos[slot]?.fullPath && nextPhotos[slot].fullPath !== uploaded.fullPath) {
        oldPathsToDelete.push(nextPhotos[slot].fullPath);
      }
      nextPhotos[slot] = uploaded;
    }

    if (!Object.keys(nextPhotos).length) {
      const deleted = await deleteProgressPhotoSet(member.code, editingSetId, set);
      if (!deleted) throw new Error("ลบชุดรูปไม่สำเร็จ กรุณาลองใหม่");
      delete savedPhotoSets[editingSetId];
    } else {
      const updated = {
        ...set,
        photos: nextPhotos,
        updatedAt: Date.now()
      };
      const saved = await saveProgressPhotoSet(member.code, editingSetId, updated);
      if (!saved) throw new Error("บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่");
      savedPhotoSets[editingSetId] = updated;
      await Promise.allSettled(oldPathsToDelete.map((path) => deleteStoredImage(path)));
    }
    Object.values(editPending).forEach((value) => {
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    });
    editingSetId = null;
    editPending = {};
    editRemoved = new Set();
    editUploadedCache = {};
    activeContext = "new";
    render();
    toast("Saved");
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = "Save Changes"; }
    toast(error?.message || "Save failed");
  }
}

function chooseFile(slot, context = "new") {
  activeSlot = slot;
  activeContext = context;
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
      } else if (activeContext === "edit" && editingSetId) {
        if (editPending[activeSlot]?.previewUrl) URL.revokeObjectURL(editPending[activeSlot].previewUrl);
        editPending[activeSlot] = result;
        editRemoved.delete(activeSlot);
        delete editUploadedCache[activeSlot];
        close();
        render();
        toast("Photo ready");
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

  modal.innerHTML = uploadMarkup("Connecting...", 0);

  try {
    const firebaseReady = await waitForFirebaseReady(8000);
    if (!firebaseReady) {
      throw new Error("Firebase Authentication / Storage ยังไม่พร้อม กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
    }

    // If Storage finished previously but the metadata write failed, retry only
    // the database save. Do not upload the same image files a second time.
    if (pendingMetadataRetry) {
      const retry = pendingMetadataRetry;
      modal.innerHTML = uploadMarkup("Saving photo record...", 100);
      const saved = await saveProgressPhotoSet(member.code, retry.checkinId, retry.photoSet);
      if (!saved) {
        throw new Error("รูปอยู่ใน Storage แล้ว แต่ยังบันทึกรายการรูปไม่สำเร็จ กรุณาลองใหม่");
      }

      savedPhotoSets[retry.checkinId] = retry.photoSet;
      const queued = loadPendingPhotoSets(member.code);
      delete queued[retry.checkinId];
      savePendingPhotoSets(member.code, queued);
      pendingMetadataRetry = null;

      Object.values(pending).forEach((value) => URL.revokeObjectURL(value.previewUrl));
      pending = {};
      modal.hidden = true;
      render();
      toast("Saved");
      return;
    }

    modal.innerHTML = uploadMarkup("Uploading photos...", 0);
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

    const photoSet = {
      id: checkinId,
      createdAt: Date.now(),
      createdDate: new Date().toISOString(),
      photos: uploaded
    };
    const metadataSaved = await saveProgressPhotoSet(member.code, checkinId, photoSet);
    if (!metadataSaved) {
      // The image files are already in Storage at this point. Keep their URLs
      // locally so a temporary Realtime Database failure cannot orphan the set.
      queuePendingPhotoSet(member.code, checkinId, photoSet);
      pendingMetadataRetry = { checkinId, photoSet };
      throw new Error("รูปถูกอัปโหลดแล้ว แต่ยังบันทึกรายการรูปไม่สำเร็จ ระบบเก็บไว้รอ Sync ให้แล้ว กรุณากด Retry");
    }

    savedPhotoSets[checkinId] = photoSet;
    const queued = loadPendingPhotoSets(member.code);
    if (queued[checkinId]) {
      delete queued[checkinId];
      savePendingPhotoSets(member.code, queued);
    }

    Object.values(pending).forEach((value) => URL.revokeObjectURL(value.previewUrl));
    pending = {};
    modal.hidden = true;
    render();
    toast("Saved");
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

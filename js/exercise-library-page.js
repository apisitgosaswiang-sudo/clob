import { navigate } from "./router.js";
import {
  EXERCISE_CATEGORIES,
  loadExerciseLibrary,
  loadExercisePrefs,
  filterExercises,
  createBlankExercise,
  createExerciseId,
  saveExercise,
  saveCoreExerciseImage,
  removeExercise,
  toggleFavorite,
  markExerciseRecent
} from "./exercise-library.js";
import { uploadImage } from "./firebase.js";

const app = document.querySelector("#app");
let exercises = [];
let prefs = { favorites: {}, recent: [] };
let state = { query: "", category: "All", tab: "All" };
let editingExercise = null;

function page(content) {
  app.innerHTML = `<main class="page trainer-page">${content}</main>`;
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const el = document.querySelector("#library-toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 1800);
}

export async function renderExerciseLibraryPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  [exercises, prefs] = await Promise.all([
    loadExerciseLibrary(),
    loadExercisePrefs()
  ]);

  renderLibrary();
}

function renderLibrary() {
  const visible = filterExercises(exercises, { ...state, prefs });

  page(`
    <div class="library-screen">
      <header class="library-header">
        <div>
          <p class="section-label">TRAINER</p>
          <h1>Exercise Library</h1>
        </div>
        <button id="new-exercise" class="library-add-button" aria-label="Add Exercise">＋</button>
      </header>

      <div class="library-search">
        <span>⌕</span>
        <input id="library-query" value="${esc(state.query)}" placeholder="Search Exercise" />
      </div>

      <div class="library-tabs">
        ${["All","Favorites","Recent"].map(tab => `
          <button data-tab="${tab}" class="${state.tab === tab ? "is-active" : ""}">${tab}</button>
        `).join("")}
      </div>

      <div class="library-categories">
        ${["All", ...EXERCISE_CATEGORIES].map(category => `
          <button data-category="${category}" class="${state.category === category ? "is-active" : ""}">
            ${category}
          </button>
        `).join("")}
      </div>

      <section class="library-count">
        <strong>${visible.length}</strong>
        <span>Exercises</span>
      </section>

      <section id="library-grid" class="library-grid">
        ${libraryMarkup(visible)}
      </section>

      <div id="library-toast" class="toast" hidden></div>
      <div id="exercise-detail-modal" class="builder-modal" hidden></div>
      <div id="exercise-editor-modal" class="builder-modal" hidden></div>

      <nav class="bottom-nav trainer-bottom-nav" aria-label="Trainer Menu">
        <button class="nav-item" data-route="/trainer"><span>⌂</span><small>Dashboard</small></button>
        <button class="nav-item" data-route="/members"><span>👥</span><small>Members</small></button>
        <button class="nav-item" data-route="/programs"><span>▤</span><small>Programs</small></button>
        <button class="nav-item is-active" data-route="/library"><span>✦</span><small>Library</small></button>
        <button class="nav-item" data-route="/trainer-settings"><span>⚙</span><small>Settings</small></button>
      </nav>
    </div>
  `);

  bindLibrary();
}

function libraryMarkup(items) {
  if (!items.length) {
    return `<div class="library-empty card"><strong>No Exercise</strong><p>Try another filter.</p></div>`;
  }

  return items.map(exercise => `
    <article class="exercise-card card">
      <button class="exercise-card-main" data-open-exercise="${exercise.id}">
        <div class="exercise-visual">${exercise.imageUrl ? `<img src="${esc(exercise.imageUrl)}" alt="">` : esc(exercise.category.slice(0, 1))}</div>
        <div>
          <span>${esc(exercise.category)} · ${exercise.builtIn ? "Core" : "My Exercise"}</span>
          <h3>${esc(exercise.name)}</h3>
          <p>${esc(exercise.primaryMuscle)} · ${esc(exercise.equipment)}</p>
        </div>
      </button>
      <button class="favorite-button ${prefs.favorites[exercise.id] ? "is-favorite" : ""}"
              data-favorite="${exercise.id}" aria-label="Favorite">☆</button>
    </article>
  `).join("");
}

function bindLibrary() {
  document.querySelector("#library-query").addEventListener("input", event => {
    state.query = event.target.value;
    refreshGrid();
  });

  document.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      renderLibrary();
    });
  });

  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderLibrary();
    });
  });

  document.querySelectorAll("[data-open-exercise]").forEach(button => {
    button.addEventListener("click", async () => {
      const exercise = exercises.find(item => item.id === button.dataset.openExercise);
      prefs = await markExerciseRecent(exercise.id);
      openDetail(exercise);
    });
  });

  document.querySelectorAll("[data-favorite]").forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();
      prefs = await toggleFavorite(button.dataset.favorite);
      refreshGrid();
      toast(prefs.favorites[button.dataset.favorite] ? "Favorite" : "Removed");
    });
  });

  document.querySelector("#new-exercise").addEventListener("click", () => {
    editingExercise = createBlankExercise();
    openEditor(editingExercise);
  });

  document.querySelectorAll("[data-route]").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });

  
}

function refreshGrid() {
  const visible = filterExercises(exercises, { ...state, prefs });
  document.querySelector("#library-grid").innerHTML = libraryMarkup(visible);
  document.querySelector(".library-count strong").textContent = visible.length;
  bindGridOnly();
}

function bindGridOnly() {
  document.querySelectorAll("[data-open-exercise]").forEach(button => {
    button.addEventListener("click", async () => {
      const exercise = exercises.find(item => item.id === button.dataset.openExercise);
      prefs = await markExerciseRecent(exercise.id);
      openDetail(exercise);
    });
  });

  document.querySelectorAll("[data-favorite]").forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();
      prefs = await toggleFavorite(button.dataset.favorite);
      refreshGrid();
    });
  });
}

function openDetail(exercise) {
  const modal = document.querySelector("#exercise-detail-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card exercise-detail-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">${esc(exercise.category)}</p>
          <h2>${esc(exercise.name)}</h2>
        </div>
        <button id="close-detail">×</button>
      </div>

      <div class="exercise-detail-hero">${exercise.imageUrl ? `<img src="${esc(exercise.imageUrl)}" alt="">` : esc(exercise.category.slice(0, 1))}</div>

      <div class="exercise-detail-grid">
        <div><span>Primary</span><strong>${esc(exercise.primaryMuscle || "-")}</strong></div>
        <div><span>Equipment</span><strong>${esc(exercise.equipment || "-")}</strong></div>
        <div><span>Level</span><strong>${esc(exercise.difficulty || "-")}</strong></div>
        <div><span>Secondary</span><strong>${esc((exercise.secondaryMuscles || []).join(", ") || "-")}</strong></div>
      </div>

      <section class="coach-tip">
        <span>Coach Tip</span>
        <p>${esc(exercise.coachTip || "Add a short coaching cue.")}</p>
      </section>

      ${exercise.videoUrl ? `<a class="exercise-link" target="_blank" rel="noopener" href="${esc(exercise.videoUrl)}">Open Video ↗</a>` : ""}
      ${exercise.gifUrl ? `<a class="exercise-link" target="_blank" rel="noopener" href="${esc(exercise.gifUrl)}">Open GIF ↗</a>` : ""}

      <div class="detail-actions">
        ${exercise.builtIn
          ? `<button id="edit-exercise" class="button button-secondary">แก้ไขรูปภาพ</button><span class="exercise-readonly-note">รายละเอียดอื่นของท่า Core แก้ไขไม่ได้</span>`
          : `<button id="edit-exercise" class="button button-secondary">Edit</button>`}
        <button id="detail-favorite" class="button button-primary">
          ${prefs.favorites[exercise.id] ? "Unfavorite" : "Favorite"}
        </button>
      </div>
    </div>
  `;

  document.querySelector("#close-detail").addEventListener("click", () => modal.hidden = true);
  document.querySelector("#edit-exercise")?.addEventListener("click", () => {
    modal.hidden = true;
    editingExercise = JSON.parse(JSON.stringify(exercise));
    openEditor(editingExercise);
  });
  document.querySelector("#detail-favorite").addEventListener("click", async () => {
    prefs = await toggleFavorite(exercise.id);
    modal.hidden = true;
    renderLibrary();
  });
}

function photoPreviewMarkup(exercise) {
  if (exercise.imageUrl) {
    return `<img src="${esc(exercise.imageUrl)}" alt=""><button type="button" id="remove-exercise-photo" class="exercise-photo-remove" aria-label="ลบรูป">×</button>`;
  }
  return `<span class="exercise-photo-placeholder">ยังไม่มีรูป</span>`;
}

async function resizeExerciseImage(file) {
  const bitmap = await createImageBitmap(file);
  const size = 800;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);

  let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp") {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  }
  if (!blob) throw new Error("ไม่สามารถประมวลผลรูปภาพได้");
  return blob;
}

function openEditor(exercise) {
  const isBuiltIn = !!exercise.builtIn;
  const isNew = !exercise.createdAt;
  // ต้องมี id ทันทีแม้เป็นท่าใหม่ที่ยังไม่กด Save เพราะใช้เป็น path ตอนอัปโหลดรูป
  if (!exercise.id) exercise.id = createExerciseId(exercise.name || "");

  const modal = document.querySelector("#exercise-editor-modal");
  modal.hidden = false;

  const disabledAttr = isBuiltIn ? "disabled" : "";

  modal.innerHTML = `
    <div class="builder-modal-card exercise-form-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">EXERCISE</p>
          <h2>${isBuiltIn ? "Core Exercise" : (isNew ? "New Exercise" : "Edit Exercise")}</h2>
        </div>
        <button id="close-editor">×</button>
      </div>

      <div class="exercise-photo-field">
        <span>รูปท่าออกกำลังกาย</span>
        <div id="exercise-photo-preview" class="exercise-photo-preview">${photoPreviewMarkup(exercise)}</div>
        <input type="file" id="exercise-photo-input" accept="image/*" hidden>
        <button type="button" id="exercise-photo-trigger" class="button button-secondary">${exercise.imageUrl ? "เปลี่ยนรูป" : "+ เพิ่มรูป"}</button>
        <p id="exercise-photo-status" class="exercise-photo-status"></p>
        ${isBuiltIn ? `<p class="exercise-readonly-note">ท่า Core แก้ไขได้เฉพาะรูปภาพ รายละเอียดอื่นด้านล่างล็อกไว้</p>` : ""}
      </div>

      <form id="exercise-form">
        <label class="exercise-form-field"><span>Name</span><input name="name" required value="${esc(exercise.name)}" ${disabledAttr}></label>
        <div class="exercise-form-grid">
          <label class="exercise-form-field"><span>Category</span>
            <select name="category" ${disabledAttr}>${EXERCISE_CATEGORIES.map(item => `<option ${item === exercise.category ? "selected" : ""}>${item}</option>`).join("")}</select>
          </label>
          <label class="exercise-form-field"><span>Level</span>
            <select name="difficulty" ${disabledAttr}>${["Beginner","Intermediate","Advanced"].map(item => `<option ${item === exercise.difficulty ? "selected" : ""}>${item}</option>`).join("")}</select>
          </label>
        </div>
        <div class="exercise-form-grid">
          <label class="exercise-form-field"><span>Primary Muscle</span><input name="primaryMuscle" value="${esc(exercise.primaryMuscle)}" ${disabledAttr}></label>
          <label class="exercise-form-field"><span>Equipment</span><input name="equipment" value="${esc(exercise.equipment)}" ${disabledAttr}></label>
        </div>
        <label class="exercise-form-field"><span>Secondary Muscles</span><input name="secondaryMuscles" value="${esc((exercise.secondaryMuscles || []).join(", "))}" placeholder="Glutes, Core" ${disabledAttr}></label>
        <label class="exercise-form-field"><span>Coach Tip</span><textarea name="coachTip" rows="3" ${disabledAttr}>${esc(exercise.coachTip)}</textarea></label>
        <label class="exercise-form-field"><span>Video URL</span><input name="videoUrl" type="url" value="${esc(exercise.videoUrl)}" ${disabledAttr}></label>
        <label class="exercise-form-field"><span>GIF URL</span><input name="gifUrl" type="url" value="${esc(exercise.gifUrl)}" ${disabledAttr}></label>
        <label class="exercise-form-field"><span>Notes</span><textarea name="notes" rows="2" ${disabledAttr}>${esc(exercise.notes)}</textarea></label>

        ${isBuiltIn ? "" : `
          <button class="button button-primary" type="submit">Save</button>
          ${!isNew ? `<button id="delete-exercise" class="button button-danger" type="button">Delete</button>` : ""}
        `}
      </form>
    </div>
  `;

  document.querySelector("#close-editor").addEventListener("click", () => modal.hidden = true);

  function updateLibraryCache(updated) {
    const index = exercises.findIndex(item => item.id === updated.id);
    if (index >= 0) exercises[index] = updated;
    else exercises.push(updated);
  }

  function bindRemovePhotoButton() {
    document.querySelector("#remove-exercise-photo")?.addEventListener("click", async () => {
      exercise.imageUrl = "";
      exercise.imagePath = "";
      document.querySelector("#exercise-photo-preview").innerHTML = photoPreviewMarkup(exercise);
      document.querySelector("#exercise-photo-trigger").textContent = "+ เพิ่มรูป";
      if (isBuiltIn) {
        try {
          const updated = await saveCoreExerciseImage(exercise, "", "");
          updateLibraryCache(updated);
          renderLibrary();
          toast("ลบรูปแล้ว");
        } catch (error) {
          toast(error.message || "ลบรูปไม่สำเร็จ");
        }
      }
    });
  }
  bindRemovePhotoButton();

  document.querySelector("#exercise-photo-trigger").addEventListener("click", () => {
    document.querySelector("#exercise-photo-input").click();
  });

  document.querySelector("#exercise-photo-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.querySelector("#exercise-photo-status");
    status.textContent = "กำลังอัปโหลด...";
    try {
      const blob = await resizeExerciseImage(file);
      const extension = blob.type === "image/jpeg" ? "jpg" : "webp";
      const path = `members/_exercises/${exercise.id}/photo_${Date.now()}.${extension}`;
      const upload = await uploadImage(path, blob);
      exercise.imageUrl = upload.url;
      exercise.imagePath = upload.fullPath;

      if (isBuiltIn) {
        const updated = await saveCoreExerciseImage(exercise, upload.url, upload.fullPath);
        updateLibraryCache(updated);
        renderLibrary();
      }

      document.querySelector("#exercise-photo-preview").innerHTML = photoPreviewMarkup(exercise);
      document.querySelector("#exercise-photo-trigger").textContent = "เปลี่ยนรูป";
      bindRemovePhotoButton();
      status.textContent = "อัปโหลดสำเร็จ";
      setTimeout(() => { if (status) status.textContent = ""; }, 1500);
    } catch (error) {
      status.textContent = error.message || "อัปโหลดรูปไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ";
    }
  });

  document.querySelector("#exercise-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (isBuiltIn) return;
    const data = new FormData(event.currentTarget);
    const value = {
      ...exercise,
      name: String(data.get("name")).trim(),
      category: String(data.get("category")),
      difficulty: String(data.get("difficulty")),
      primaryMuscle: String(data.get("primaryMuscle")).trim(),
      equipment: String(data.get("equipment")).trim(),
      secondaryMuscles: String(data.get("secondaryMuscles"))
        .split(",").map(item => item.trim()).filter(Boolean),
      coachTip: String(data.get("coachTip")).trim(),
      videoUrl: String(data.get("videoUrl")).trim(),
      gifUrl: String(data.get("gifUrl")).trim(),
      notes: String(data.get("notes")).trim()
    };

    const saved = await saveExercise(value);
    updateLibraryCache(saved);

    modal.hidden = true;
    renderLibrary();
    toast("Saved");
  });

  document.querySelector("#delete-exercise")?.addEventListener("click", async () => {
    if (!window.confirm(`Delete ${exercise.name}?`)) return;

    await removeExercise(exercise.id);
    exercises = exercises.filter(item => item.id !== exercise.id);
    modal.hidden = true;
    renderLibrary();
    toast("Deleted");
  });
}

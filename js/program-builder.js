import { navigate } from "./router.js";
import { loadMembers } from "./members.js";
import {
  loadPrograms,
  createBlankProgram,
  duplicateProgram,
  saveProgram,
  archiveProgram,
  removeProgram,
  assignProgram,
  addDay,
  removeDay,
  addExercise,
  removeExercise,
  moveExercise,
  countProgramExercises,
  getExerciseLibrary
} from "./programs.js";

const app = document.querySelector("#app");
let programsCache = [];
let currentProgram = null;
let activeDayId = null;

function page(content, extraClass = "") {
  app.innerHTML = `<main class="page ${extraClass}">${content}</main>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = document.querySelector("#program-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 2400);
}

export async function renderProgramsPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  programsCache = await loadPrograms();

  page(`
    <div class="programs-screen">
      <header class="programs-header">
        <div>
          <p class="section-label">TRAINER</p>
          <h1>Programs</h1>
        </div>
        <button id="new-program" class="add-member-button">＋ New Program</button>
      </header>

      <section class="program-summary-grid">
        <article class="card">
          <span>Programs</span>
          <strong>${programsCache.length}</strong>
        </article>
        <article class="card">
          <span>Active</span>
          <strong>${programsCache.filter((p) => p.status === "active").length}</strong>
        </article>
        <article class="card">
          <span>Draft</span>
          <strong>${programsCache.filter((p) => p.status === "draft").length}</strong>
        </article>
      </section>

      <section class="program-search-wrap">
        <span>⌕</span>
        <input id="program-search" type="search" placeholder="ค้นหาโปรแกรม..." />
      </section>

      <section id="program-list" class="program-list">
        ${programListMarkup(programsCache)}
      </section>

      <div id="program-toast" class="toast" hidden></div>

      <nav class="bottom-nav trainer-bottom-nav" aria-label="เมนูเทรนเนอร์">
        <button class="nav-item" data-route="/trainer">
          <span>⌂</span><small>Dashboard</small>
        </button>
        <button class="nav-item" data-route="/members">
          <span>👥</span><small>Members</small>
        </button>
        <button class="nav-item is-active" data-route="/programs">
          <span>▤</span><small>Programs</small>
        </button>
        <button class="nav-item" data-route="/library">
          <span>✦</span><small>Library</small>
        </button>
        <button class="nav-item" data-route="/trainer-settings">
          <span>⚙</span><small>Settings</small>
        </button>
      </nav>
    </div>
  `, "trainer-page");

  bindProgramsPage();
}

function programListMarkup(programs) {
  if (!programs.length) {
    return `<div class="members-empty card"><strong>ยังไม่มีโปรแกรม</strong><p>กด New Program เพื่อเริ่มสร้าง</p></div>`;
  }

  return programs.map((program) => `
    <article class="program-card card">
      <button class="program-card-main" data-open-program="${program.id}">
        <div class="program-icon">▤</div>
        <div>
          <h3>${escapeHtml(program.name)}</h3>
          <p>${escapeHtml(program.goal)} · ${escapeHtml(program.level)}</p>
          <span>${program.days.length} Days · ${countProgramExercises(program)} Exercises</span>
        </div>
      </button>
      <div class="program-card-footer">
        <span class="program-status status-${program.status}">${program.status}</span>
        <button data-duplicate="${program.id}">Duplicate</button>
        <button data-archive="${program.id}">Archive</button>
      </div>
    </article>
  `).join("");
}

function bindProgramsPage() {
  document.querySelectorAll("[data-open-program]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(`/program-builder-${button.dataset.openProgram}`);
    });
  });

  document.querySelectorAll("[data-duplicate]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = programsCache.find((item) => item.id === button.dataset.duplicate);
      const copy = duplicateProgram(source);
      await saveProgram(copy);
      programsCache.unshift(copy);
      document.querySelector("#program-list").innerHTML = programListMarkup(programsCache);
      bindProgramsPage();
      showToast("Duplicate Program แล้ว");
    });
  });

  document.querySelectorAll("[data-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      const program = programsCache.find((item) => item.id === button.dataset.archive);
      await archiveProgram(program);
      document.querySelector("#program-list").innerHTML = programListMarkup(programsCache);
      bindProgramsPage();
      showToast("Archive Program แล้ว");
    });
  });

  document.querySelector("#new-program").addEventListener("click", async () => {
    const program = createBlankProgram();
    await saveProgram(program);
    navigate(`/program-builder-${program.id}`);
  });

  document.querySelector("#program-search").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const filtered = programsCache.filter((program) =>
      program.name.toLowerCase().includes(query) ||
      program.goal.toLowerCase().includes(query)
    );
    document.querySelector("#program-list").innerHTML = programListMarkup(filtered);
    bindProgramsPage();
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
}

export async function renderProgramBuilder(programId) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  if (!programsCache.length) programsCache = await loadPrograms();

  currentProgram = programsCache.find((item) => item.id === programId);
  if (!currentProgram) {
    navigate("/programs");
    return;
  }

  activeDayId = activeDayId && currentProgram.days.some((d) => d.id === activeDayId)
    ? activeDayId
    : currentProgram.days[0].id;

  renderBuilder();
}

function renderBuilder() {
  const activeDay = currentProgram.days.find((day) => day.id === activeDayId);

  page(`
    <div class="builder-screen">
      <header class="builder-header">
        <button id="builder-back" class="back-button">←</button>
        <div>
          <p class="section-label">PROGRAM BUILDER</p>
          <h1>${escapeHtml(currentProgram.name)}</h1>
        </div>
        <button id="save-program" class="button button-text">Save</button>
      </header>

      <section class="builder-meta card">
        <label>
          <span>Program Name</span>
          <input id="program-name" value="${escapeHtml(currentProgram.name)}" />
        </label>
        <div class="builder-meta-grid">
          <label>
            <span>Goal</span>
            <select id="program-goal">
              ${["General Fitness","Fat Loss","Strength & Muscle","Mobility"].map((goal) =>
                `<option ${currentProgram.goal === goal ? "selected" : ""}>${goal}</option>`
              ).join("")}
            </select>
          </label>
          <label>
            <span>Level</span>
            <select id="program-level">
              ${["Beginner","Intermediate","Advanced"].map((level) =>
                `<option ${currentProgram.level === level ? "selected" : ""}>${level}</option>`
              ).join("")}
            </select>
          </label>
        </div>
      </section>

      <section class="builder-day-tabs">
        ${currentProgram.days.map((day) => `
          <button class="${day.id === activeDayId ? "is-active" : ""}" data-day-tab="${day.id}">
            ${escapeHtml(day.name)}
          </button>
        `).join("")}
        <button id="add-day" class="add-day-tab">＋ Day</button>
      </section>

      <section class="builder-day-header">
        <input id="day-name" value="${escapeHtml(activeDay.name)}" />
        <button id="remove-day">ลบวันนี้</button>
      </section>

      <section class="builder-exercise-list">
        ${activeDay.exercises.length ? activeDay.exercises.map((exercise, index) =>
          exerciseEditorMarkup(exercise, index)
        ).join("") : `
          <div class="builder-empty card">
            <strong>ยังไม่มีท่าในวันนี้</strong>
            <p>กด Add Exercise เพื่อเริ่มสร้าง Workout Day</p>
          </div>
        `}
      </section>

      <button id="add-exercise" class="button button-secondary builder-add-exercise">＋ Add Exercise</button>

      <section class="builder-actions">
        <button id="assign-program" class="button button-primary">Assign to Member</button>
        <button id="delete-program" class="button button-danger">Delete Program</button>
      </section>

      <div id="program-toast" class="toast" hidden></div>
      <div id="exercise-modal" class="builder-modal" hidden></div>
      <div id="assign-modal" class="builder-modal" hidden></div>
    </div>
  `, "trainer-page");

  bindBuilder(activeDay);
}

function exerciseEditorMarkup(exercise, index) {
  return `
    <article class="exercise-editor card">
      <div class="exercise-editor-head">
        <div>
          <span class="exercise-index">${index + 1}</span>
          <div>
            <h3>${escapeHtml(exercise.name)}</h3>
            <p>${escapeHtml(exercise.category)}</p>
          </div>
        </div>
        <div class="exercise-order-buttons">
          <button data-move-up="${exercise.uid}">↑</button>
          <button data-move-down="${exercise.uid}">↓</button>
          <button data-remove-exercise="${exercise.uid}">×</button>
        </div>
      </div>

      <div class="exercise-fields">
        <label><span>Sets</span><input data-field="sets" data-uid="${exercise.uid}" type="number" min="1" value="${exercise.sets}"></label>
        <label><span>Reps</span><input data-field="reps" data-uid="${exercise.uid}" value="${escapeHtml(exercise.reps)}"></label>
        <label><span>Weight</span><input data-field="weight" data-uid="${exercise.uid}" type="number" step="0.5" value="${exercise.weight}"></label>
        <label><span>RPE</span><input data-field="rpe" data-uid="${exercise.uid}" type="number" min="1" max="10" step="0.5" value="${exercise.rpe}"></label>
        <label><span>Tempo</span><input data-field="tempo" data-uid="${exercise.uid}" value="${escapeHtml(exercise.tempo)}"></label>
        <label><span>Rest</span><input data-field="rest" data-uid="${exercise.uid}" type="number" value="${exercise.rest}"></label>
      </div>

      <label class="exercise-notes">
        <span>Notes</span>
        <textarea data-field="notes" data-uid="${exercise.uid}" rows="2">${escapeHtml(exercise.notes || "")}</textarea>
      </label>
    </article>
  `;
}

function bindBuilder(activeDay) {
  document.querySelector("#builder-back").addEventListener("click", () => navigate("/programs"));

  document.querySelectorAll("[data-day-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      syncMeta(activeDay);
      activeDayId = button.dataset.dayTab;
      renderBuilder();
    });
  });

  document.querySelector("#add-day").addEventListener("click", () => {
    syncMeta(activeDay);
    addDay(currentProgram);
    activeDayId = currentProgram.days[currentProgram.days.length - 1].id;
    renderBuilder();
  });

  document.querySelector("#remove-day").addEventListener("click", () => {
    if (currentProgram.days.length <= 1) {
      showToast("Program ต้องมีอย่างน้อย 1 วัน");
      return;
    }
    removeDay(currentProgram, activeDay.id);
    activeDayId = currentProgram.days[0].id;
    renderBuilder();
  });

  document.querySelector("#add-exercise").addEventListener("click", () => {
    syncMeta(activeDay);
    openExerciseModal();
  });

  document.querySelectorAll("[data-remove-exercise]").forEach((button) => {
    button.addEventListener("click", () => {
      syncMeta(activeDay);
      removeExercise(currentProgram, activeDay.id, button.dataset.removeExercise);
      renderBuilder();
    });
  });

  document.querySelectorAll("[data-move-up]").forEach((button) => {
    button.addEventListener("click", () => {
      syncMeta(activeDay);
      moveExercise(currentProgram, activeDay.id, button.dataset.moveUp, "up");
      renderBuilder();
    });
  });

  document.querySelectorAll("[data-move-down]").forEach((button) => {
    button.addEventListener("click", () => {
      syncMeta(activeDay);
      moveExercise(currentProgram, activeDay.id, button.dataset.moveDown, "down");
      renderBuilder();
    });
  });

  document.querySelector("#save-program").addEventListener("click", async () => {
    syncMeta(activeDay);
    await saveProgram(currentProgram);
    showToast("บันทึก Program แล้ว");
  });

  document.querySelector("#assign-program").addEventListener("click", async () => {
    syncMeta(activeDay);
    await saveProgram(currentProgram);
    openAssignModal();
  });

  document.querySelector("#delete-program").addEventListener("click", async () => {
    if (!window.confirm(`ลบ ${currentProgram.name} หรือไม่?`)) return;
    await removeProgram(currentProgram.id);
    navigate("/programs");
  });
}

function syncMeta(activeDay) {
  currentProgram.name = document.querySelector("#program-name")?.value.trim() || "Untitled Program";
  currentProgram.goal = document.querySelector("#program-goal")?.value || "General Fitness";
  currentProgram.level = document.querySelector("#program-level")?.value || "Beginner";
  activeDay.name = document.querySelector("#day-name")?.value.trim() || "Workout Day";

  document.querySelectorAll("[data-field]").forEach((input) => {
    const exercise = activeDay.exercises.find((item) => item.uid === input.dataset.uid);
    if (!exercise) return;
    const field = input.dataset.field;
    exercise[field] = ["sets","weight","rpe","rest"].includes(field)
      ? Number(input.value || 0)
      : input.value;
  });
}

async function openExerciseModal() {
  const modal = document.querySelector("#exercise-modal");
  const library = await getExerciseLibrary();

  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">EXERCISE LIBRARY</p>
          <h2>Add Exercise</h2>
        </div>
        <button id="close-exercise-modal">×</button>
      </div>
      <input id="exercise-search" class="modal-search" type="search" placeholder="ค้นหาท่า..." />
      <div id="exercise-library-list" class="exercise-library-list">
        ${exerciseLibraryMarkup(library)}
      </div>
    </div>
  `;

  const bindLibrary = () => {
    document.querySelectorAll("[data-add-library-exercise]").forEach((button) => {
      button.addEventListener("click", () => {
        addExercise(currentProgram, activeDayId, button.dataset.addLibraryExercise);
        modal.hidden = true;
        renderBuilder();
      });
    });
  };

  bindLibrary();

  document.querySelector("#exercise-search").addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    const filtered = library.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
    document.querySelector("#exercise-library-list").innerHTML = exerciseLibraryMarkup(filtered);
    bindLibrary();
  });

  document.querySelector("#close-exercise-modal").addEventListener("click", () => {
    modal.hidden = true;
  });
}

function exerciseLibraryMarkup(items) {
  return items.map((exercise) => `
    <button class="library-exercise-row" data-add-library-exercise="${exercise.id}">
      <span>＋</span>
      <div>
        <strong>${escapeHtml(exercise.name)}</strong>
        <small>${escapeHtml(exercise.category)} · ${escapeHtml(exercise.equipment)}</small>
      </div>
    </button>
  `).join("");
}

async function openAssignModal() {
  const modal = document.querySelector("#assign-modal");
  const members = await loadMembers();
  const today = new Date().toISOString().slice(0, 10);

  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">ASSIGN PROGRAM</p>
          <h2>${escapeHtml(currentProgram.name)}</h2>
        </div>
        <button id="close-assign-modal">×</button>
      </div>

      <label class="assign-field">
        <span>Member</span>
        <select id="assign-member">
          ${members.map((member) =>
            `<option value="${member.code}">${escapeHtml(member.name)} · ${member.code}</option>`
          ).join("")}
        </select>
      </label>

      <label class="assign-field">
        <span>Effective Date</span>
        <input id="assign-date" type="date" value="${today}" />
      </label>

      <button id="confirm-assign" class="button button-primary">Assign Program</button>
    </div>
  `;

  document.querySelector("#close-assign-modal").addEventListener("click", () => {
    modal.hidden = true;
  });

  document.querySelector("#confirm-assign").addEventListener("click", async () => {
    const memberCode = document.querySelector("#assign-member").value;
    const effectiveDate = document.querySelector("#assign-date").value;
    await assignProgram(currentProgram, memberCode, effectiveDate);
    modal.hidden = true;
    showToast("Assign Program ให้สมาชิกแล้ว");
  });
}

import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import { drawLineChart } from "./progress-charts.js";
import { loadPRs, savePR, removePR, latestPRsByExercise } from "./prs.js";
import {
  createBlankCheckin,
  loadCheckins,
  saveCheckin,
  removeCheckin,
  latestValue,
  calculateChange,
  formatMetric
} from "./checkins.js";

const app = document.querySelector("#app");
let member = null;
let checkins = [];
let prs = [];
let editing = null;
let activeChart = "weight";

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function deltaText(value, unit) {
  if (value === null) return "No trend";
  if (value === 0) return "No change";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} ${unit}`;
}

export async function renderProgressPage(code) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const members = await loadMembers();
  member = getMemberByCode(members, code);
  if (!member) {
    navigate("/members");
    return;
  }

  [checkins, prs] = await Promise.all([loadCheckins(member.code), loadPRs(member.code)]);
  render();
}

function render() {
  const weight = latestValue(checkins, "weight");
  const bodyFat = latestValue(checkins, "bodyFat");
  const waist = latestValue(checkins, "waist");
  const muscle = latestValue(checkins, "skeletalMuscle");

  app.innerHTML = `
    <main class="page trainer-page">
      <div class="progress-screen">
        <header class="progress-header">
          <button id="progress-back" class="back-button">←</button>
          <div>
            <p class="section-label">MEMBER</p>
            <h1>Progress</h1>
          </div>
          <button id="new-checkin" class="progress-add">＋</button>
        </header>

        <section class="progress-member card">
          <div class="progress-avatar">
            ${member.profilePhoto
              ? `<img src="${esc(member.profilePhoto)}" alt="">`
              : esc(member.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <strong>${esc(member.name)}</strong>
            <span>${esc(member.code)}</span>
          </div>
          <button id="open-photos">Photos</button>
        </section>

        <section class="metric-grid">
          ${metricCard("Weight", formatMetric(weight, "kg"), deltaText(calculateChange(checkins, "weight"), "kg"))}
          ${metricCard("Body Fat", formatMetric(bodyFat, "%"), deltaText(calculateChange(checkins, "bodyFat"), "%"))}
          ${metricCard("Waist", formatMetric(waist, "cm"), deltaText(calculateChange(checkins, "waist"), "cm"))}
          ${metricCard("Muscle", formatMetric(muscle, "kg"), deltaText(calculateChange(checkins, "skeletalMuscle"), "kg"))}
        </section>

        <section class="progress-chart-card card">
          <div class="progress-chart-head">
            <div>
              <p class="section-label">TREND</p>
              <h2>Progress Chart</h2>
            </div>
            <div class="chart-tabs">
              ${["weight","bodyFat","waist"].map((field) => `
                <button data-chart="${field}" class="${activeChart === field ? "is-active" : ""}">
                  ${field === "bodyFat" ? "Body Fat" : field.charAt(0).toUpperCase() + field.slice(1)}
                </button>
              `).join("")}
            </div>
          </div>
          <canvas id="progress-line-chart"></canvas>
        </section>

        <section class="adherence-card card">
          <div>
            <p class="section-label">CONSISTENCY</p>
            <h2>Check-in Adherence</h2>
          </div>
          <div class="adherence-score">
            <strong>${Math.min(100, checkins.length * 25)}%</strong>
            <span>${checkins.length} Check-ins</span>
          </div>
          <div class="adherence-bars">
            ${Array.from({length: 8}, (_, i) => `<span class="${i < Math.min(8, checkins.length) ? "is-done" : ""}"></span>`).join("")}
          </div>
        </section>

        <section class="before-after-card card">
          <div class="before-after-head">
            <div>
              <p class="section-label">PHOTOS</p>
              <h2>Before / After</h2>
            </div>
            <button id="before-after-open">Open</button>
          </div>
          <p>Compare progress photos side by side.</p>
        </section>

        <section class="pr-head">
          <div>
            <p class="section-label">STRENGTH</p>
            <h2>Personal Records</h2>
          </div>
          <button id="add-pr">＋</button>
        </section>

        <section class="pr-list">
          ${prMarkup()}
        </section>

        <section class="timeline-head">
          <div>
            <p class="section-label">CHECK-INS</p>
            <h2>Timeline</h2>
          </div>
          <span>${checkins.length}</span>
        </section>

        <section class="checkin-timeline">
          ${timelineMarkup()}
        </section>

        <div id="checkin-modal" class="builder-modal" hidden></div>
        <div id="pr-modal" class="builder-modal" hidden></div>
        <div id="progress-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  bind();
}

function metricCard(label, value, delta) {
  return `
    <article class="metric-card card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${delta}</small>
    </article>
  `;
}

function timelineMarkup() {
  if (!checkins.length) {
    return `
      <article class="empty-checkin card">
        <strong>No Check-in</strong>
        <p>Add the first progress entry.</p>
        <button id="empty-add" class="button button-primary">Add Check-in</button>
      </article>
    `;
  }

  return checkins.map((item) => `
    <article class="checkin-card card">
      <button class="checkin-main" data-checkin="${item.id}">
        <div class="checkin-date">
          <strong>${formatDate(item.date)}</strong>
          <span>${item.note ? esc(item.note) : "Progress update"}</span>
        </div>

        <div class="checkin-values">
          <div><span>Weight</span><strong>${formatMetric(item.weight, "kg")}</strong></div>
          <div><span>Body Fat</span><strong>${formatMetric(item.bodyFat, "%")}</strong></div>
          <div><span>Waist</span><strong>${formatMetric(item.waist, "cm")}</strong></div>
        </div>
      </button>
      <button class="checkin-menu" data-delete-checkin="${item.id}" aria-label="Delete">×</button>
    </article>
  `).join("");
}


function prMarkup() {
  const best = latestPRsByExercise(prs);
  if (!best.length) {
    return `<article class="empty-pr card"><strong>No PR</strong><p>Add a strength record.</p></article>`;
  }

  return best.slice(0, 6).map((pr) => `
    <article class="pr-card card">
      <div>
        <span>${esc(pr.exercise)}</span>
        <strong>${Number(pr.weight || 0).toFixed(Number(pr.weight || 0) % 1 ? 1 : 0)} ${esc(pr.unit || "kg")}</strong>
        <small>${formatDate(pr.date)}</small>
      </div>
      <button data-delete-pr="${pr.id}">×</button>
    </article>
  `).join("");
}

function bind() {
  document.querySelector("#progress-back").addEventListener("click", () => {
    navigate(`/member-detail-${member.code}`);
  });

  document.querySelector("#new-checkin").addEventListener("click", () => {
    editing = createBlankCheckin(member.code);
    openEditor(editing);
  });

  document.querySelector("#open-photos").addEventListener("click", () => {
    navigate(`/progress-photos-${member.code}`);
  });

  document.querySelector("#before-after-open").addEventListener("click", () => {
    navigate(`/progress-photos-${member.code}`);
  });

  document.querySelectorAll("[data-chart]").forEach((button) => {
    button.addEventListener("click", () => {
      activeChart = button.dataset.chart;
      render();
    });
  });

  document.querySelector("#add-pr").addEventListener("click", openPREditor);

  document.querySelectorAll("[data-delete-pr]").forEach((button) => {
    button.addEventListener("click", async () => {
      const pr = prs.find((item) => item.id === button.dataset.deletePr);
      if (!window.confirm(`Delete ${pr.exercise} PR?`)) return;
      await removePR(member.code, pr.id);
      prs = prs.filter((item) => item.id !== pr.id);
      render();
      toast("Deleted");
    });
  });

  drawProgressChart();


  document.querySelector("#empty-add")?.addEventListener("click", () => {
    editing = createBlankCheckin(member.code);
    openEditor(editing);
  });

  document.querySelectorAll("[data-checkin]").forEach((button) => {
    button.addEventListener("click", () => {
      editing = JSON.parse(JSON.stringify(
        checkins.find((item) => item.id === button.dataset.checkin)
      ));
      openEditor(editing);
    });
  });

  document.querySelectorAll("[data-delete-checkin]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const item = checkins.find((entry) => entry.id === button.dataset.deleteCheckin);
      if (!window.confirm(`Delete check-in on ${formatDate(item.date)}?`)) return;
      await removeCheckin(member.code, item.id);
      checkins = checkins.filter((entry) => entry.id !== item.id);
      render();
      toast("Deleted");
    });
  });
}

function openEditor(checkin) {
  const modal = document.querySelector("#checkin-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card checkin-form-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">CHECK-IN</p>
          <h2>${checkin.id ? "Edit Check-in" : "New Check-in"}</h2>
        </div>
        <button id="checkin-close">×</button>
      </div>

      <form id="checkin-form">
        <label class="checkin-field">
          <span>Date</span>
          <input name="date" type="date" required value="${esc(checkin.date)}">
        </label>

        <div class="checkin-form-grid">
          ${numberField("weight", "Weight", "kg", checkin.weight)}
          ${numberField("bodyFat", "Body Fat", "%", checkin.bodyFat)}
        </div>

        <div class="checkin-form-grid">
          ${numberField("skeletalMuscle", "Muscle", "kg", checkin.skeletalMuscle)}
          ${numberField("waist", "Waist", "cm", checkin.waist)}
        </div>

        <div class="checkin-form-grid">
          ${numberField("chest", "Chest", "cm", checkin.chest)}
          ${numberField("hip", "Hip", "cm", checkin.hip)}
        </div>

        <div class="checkin-form-grid">
          ${numberField("arm", "Arm", "cm", checkin.arm)}
          ${numberField("thigh", "Thigh", "cm", checkin.thigh)}
        </div>

        <label class="checkin-field">
          <span>Note</span>
          <textarea name="note" rows="3" placeholder="Short note">${esc(checkin.note)}</textarea>
        </label>

        <button class="button button-primary" type="submit">Save</button>
      </form>
    </div>
  `;

  document.querySelector("#checkin-close").addEventListener("click", () => {
    modal.hidden = true;
  });

  document.querySelector("#checkin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = {
      ...checkin,
      date: String(data.get("date")),
      weight: cleanNumber(data.get("weight")),
      bodyFat: cleanNumber(data.get("bodyFat")),
      skeletalMuscle: cleanNumber(data.get("skeletalMuscle")),
      chest: cleanNumber(data.get("chest")),
      waist: cleanNumber(data.get("waist")),
      hip: cleanNumber(data.get("hip")),
      arm: cleanNumber(data.get("arm")),
      thigh: cleanNumber(data.get("thigh")),
      note: String(data.get("note")).trim()
    };

    const saved = await saveCheckin(member.code, value);
    const index = checkins.findIndex((item) => item.id === saved.id);
    if (index >= 0) checkins[index] = saved;
    else checkins.push(saved);

    checkins.sort((a, b) => new Date(b.date) - new Date(a.date));
    modal.hidden = true;
    render();
    toast("Saved");
  });
}


function drawProgressChart() {
  const canvas = document.querySelector("#progress-line-chart");
  if (!canvas) return;

  const labels = {
    weight: "Weight",
    bodyFat: "Body Fat",
    waist: "Waist"
  };

  const points = [...checkins]
    .reverse()
    .filter((item) => item[activeChart] !== "" && Number.isFinite(Number(item[activeChart])))
    .map((item) => ({
      label: new Intl.DateTimeFormat("en-GB", { month: "short", day: "2-digit" })
        .format(new Date(`${item.date}T00:00:00`)),
      value: Number(item[activeChart])
    }));

  drawLineChart(canvas, points, { label: labels[activeChart] });
}

function openPREditor() {
  const modal = document.querySelector("#pr-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card pr-form-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">NEW PR</p>
          <h2>Personal Record</h2>
        </div>
        <button id="pr-close">×</button>
      </div>

      <form id="pr-form">
        <label class="checkin-field">
          <span>Exercise</span>
          <input name="exercise" required placeholder="Bench Press">
        </label>

        <div class="checkin-form-grid">
          <label class="checkin-field">
            <span>Weight</span>
            <div class="metric-input">
              <input name="weight" type="number" min="0" step="0.1" required>
              <small>kg</small>
            </div>
          </label>

          <label class="checkin-field">
            <span>Reps</span>
            <div class="metric-input">
              <input name="reps" type="number" min="1" step="1" value="1">
              <small>reps</small>
            </div>
          </label>
        </div>

        <label class="checkin-field">
          <span>Date</span>
          <input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}">
        </label>

        <button class="button button-primary" type="submit">Save</button>
      </form>
    </div>
  `;

  document.querySelector("#pr-close").addEventListener("click", () => modal.hidden = true);
  document.querySelector("#pr-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const saved = await savePR(member.code, {
      exercise: String(data.get("exercise")).trim(),
      weight: Number(data.get("weight")),
      reps: Number(data.get("reps")),
      unit: "kg",
      date: String(data.get("date"))
    });
    prs.push(saved);
    modal.hidden = true;
    render();
    toast("Saved");
  });
}

function numberField(name, label, unit, value) {
  return `
    <label class="checkin-field">
      <span>${label}</span>
      <div class="metric-input">
        <input name="${name}" type="number" min="0" step="0.1" value="${esc(value)}">
        <small>${unit}</small>
      </div>
    </label>
  `;
}

function cleanNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? number : "";
}

function toast(message) {
  const el = document.querySelector("#progress-toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 1800);
}

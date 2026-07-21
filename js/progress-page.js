import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
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
let editing = null;

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

  checkins = await loadCheckins(member.code);
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

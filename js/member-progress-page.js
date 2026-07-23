import { navigate } from "./router.js";
import { loadMember } from "./member.js";
import {
  createBlankCheckin,
  loadCheckins,
  saveCheckin,
  latestValue,
  calculateChange,
  formatMetric
} from "./checkins.js";
import { getProgressPhotoSets } from "./firebase.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");
const numericFields = [
  "weight",
  "bodyFat",
  "skeletalMuscle",
  "chest",
  "waist",
  "hip",
  "arm",
  "thigh"
];

let member = null;
let checkins = [];
let photoSets = {};
let editingCheckin = null;
let code = "";

export async function renderMemberProgressPage(memberCode) {
  if (sessionStorage.getItem("clob_member_code") !== memberCode) {
    navigate("/");
    return;
  }

  code = memberCode;
  app.innerHTML = `
    <main class="page member-page clob-member-progress">
      <section class="member-loading">
        <div class="loading-spinner"></div>
        <p>กำลังโหลด Progress...</p>
      </section>
    </main>
  `;

  [member, checkins, photoSets] = await Promise.all([
    loadMember(code),
    loadCheckins(code),
    getProgressPhotoSets(code)
  ]);
  photoSets = filterPhotoSets(photoSets);
  sortCheckins();
  render();
}

function render() {
  document.body.classList.remove("clob-sheet-open");

  const weight = latestValue(checkins, "weight");
  const bodyFat = latestValue(checkins, "bodyFat");
  const waist = latestValue(checkins, "waist");
  const weightChange = calculateChange(checkins, "weight");
  const todayCheckin = findByDate(todayKey());
  const photosCount = Object.keys(photoSets).length;

  app.innerHTML = `
    <main class="page member-page clob-member-progress">
      <div class="clob-progress-shell">
        <header class="clob-progress-header">
          <button id="progress-back" class="clob-icon-button" aria-label="กลับหน้า Home">←</button>
          <div>
            <p class="clob-kicker">YOUR JOURNEY</p>
            <h1>Progress</h1>
          </div>
          <button id="progress-profile" class="avatar-button" aria-label="เปิดโปรไฟล์">
            ${renderAvatar({
              name: member.name,
              photoUrl: member.profilePhoto,
              className: "member-header-avatar"
            })}
          </button>
        </header>

        <button id="member-checkin-action" class="clob-checkin-primary">
          <span>
            <small>${todayCheckin ? "TODAY'S CHECK-IN" : "BUILD YOUR TIMELINE"}</small>
            <strong>${todayCheckin ? "แก้ไข Check-in วันนี้" : "บันทึก Check-in วันนี้"}</strong>
          </span>
          <span aria-hidden="true">${todayCheckin ? "✎" : "+"}</span>
        </button>

        <section class="clob-progress-hero" aria-labelledby="latest-weight-title">
          <div>
            <p class="clob-kicker">LATEST WEIGHT</p>
            <h2 id="latest-weight-title">${formatMetric(weight, "kg")}</h2>
            <p>${escapeHtml(trendText(weightChange, checkins.length))}</p>
          </div>
          <div class="clob-progress-count">
            <strong>${checkins.length}</strong>
            <span>Check-ins</span>
          </div>
        </section>

        <section class="clob-progress-metrics" aria-label="ค่าล่าสุด">
          ${metricMarkup("Body Fat", formatMetric(bodyFat, "%"), bodyFat === null ? "ยังไม่มีข้อมูล" : "ล่าสุด")}
          ${metricMarkup("Waist", formatMetric(waist, "cm"), waist === null ? "ยังไม่มีข้อมูล" : "ล่าสุด")}
          ${metricMarkup("Photos", String(photosCount), photosCount === 1 ? "Set" : "Sets", "photos")}
        </section>

        <section class="clob-progress-section" aria-labelledby="timeline-title">
          <div class="clob-progress-section-head">
            <div>
              <p class="clob-kicker">CHECK-IN HISTORY</p>
              <h2 id="timeline-title">Timeline</h2>
            </div>
            <span>${checkins.length}</span>
          </div>

          <div class="clob-member-timeline">
            ${timelineMarkup()}
          </div>
        </section>

        <button id="progress-photos" class="clob-progress-photo-link">
          <span>
            <small>VISUAL PROGRESS</small>
            <strong>Progress Photos</strong>
          </span>
          <span aria-hidden="true">→</span>
        </button>

        <div id="member-checkin-sheet" class="clob-sheet-backdrop" hidden></div>
        <div id="progress-toast" class="toast" role="status" hidden></div>
        ${bottomNav()}
      </div>
    </main>
  `;

  bind();
}

function metricMarkup(label, value, note, action = "") {
  const tag = action ? "button" : "article";
  const actionAttribute = action ? ` data-progress-action="${action}"` : "";
  return `
    <${tag} class="clob-progress-metric"${actionAttribute}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </${tag}>
  `;
}

function timelineMarkup() {
  if (!checkins.length) {
    return `
      <article class="clob-progress-empty">
        <span aria-hidden="true">↗</span>
        <strong>เริ่มต้นจากข้อมูลวันนี้</strong>
        <p>บันทึกน้ำหนัก Body Fat หรือรอบเอว แล้ว CLOB จะสร้าง Timeline ให้คุณ</p>
        <button id="empty-checkin-action">บันทึก Check-in แรก</button>
      </article>
    `;
  }

  return checkins.slice(0, 8).map((item, index) => `
    <button class="clob-timeline-item" data-edit-checkin="${escapeHtml(item.id)}">
      <span class="clob-timeline-marker ${index === 0 ? "is-latest" : ""}" aria-hidden="true"></span>
      <span class="clob-timeline-copy">
        <small>${escapeHtml(formatDate(item.date))}${index === 0 ? " · LATEST" : ""}</small>
        <strong>${formatMetric(item.weight, "kg")}</strong>
        <span>
          ${item.bodyFat !== "" && item.bodyFat !== null && item.bodyFat !== undefined
            ? `Body Fat ${formatMetric(item.bodyFat, "%")}`
            : item.waist !== "" && item.waist !== null && item.waist !== undefined
              ? `Waist ${formatMetric(item.waist, "cm")}`
              : escapeHtml(item.note || "Progress update")}
        </span>
      </span>
      <span class="clob-timeline-edit">แก้ไข</span>
    </button>
  `).join("");
}

function bind() {
  document.querySelector("#progress-back").addEventListener("click", () => navigate("/member"));
  document.querySelector("#progress-profile").addEventListener("click", () => navigate("/member-profile"));
  document.querySelector("#member-checkin-action").addEventListener("click", () => {
    openEditor(findByDate(todayKey()));
  });
  document.querySelector("#empty-checkin-action")?.addEventListener("click", () => openEditor());
  document.querySelector("#progress-photos").addEventListener("click", openPhotos);
  document.querySelector('[data-progress-action="photos"]')?.addEventListener("click", openPhotos);

  document.querySelectorAll("[data-edit-checkin]").forEach((button) => {
    button.addEventListener("click", () => {
      openEditor(checkins.find((item) => item.id === button.dataset.editCheckin));
    });
  });

  document.querySelectorAll("[data-member-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.memberNav;
      if (target === "home") navigate("/member");
      if (target === "workout") navigate("/workout");
      if (target === "profile") navigate("/member-profile");
    });
  });
}

function openEditor(checkin = null) {
  editingCheckin = clone(checkin || createBlankCheckin(code));
  const sheet = document.querySelector("#member-checkin-sheet");
  sheet.hidden = false;
  sheet.innerHTML = editorMarkup(editingCheckin);
  document.body.classList.add("clob-sheet-open");

  const close = () => {
    sheet.hidden = true;
    document.body.classList.remove("clob-sheet-open");
  };

  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) close();
  });
  sheet.querySelector("#checkin-sheet-close").addEventListener("click", close);
  sheet.querySelector("#member-checkin-form").addEventListener("submit", saveEditor);
  sheet.querySelector('[name="date"]').addEventListener("change", (event) => {
    const existing = findByDate(event.currentTarget.value);
    if (!existing || existing.id === editingCheckin.id) return;
    editingCheckin = clone(existing);
    fillEditor(sheet.querySelector("form"), editingCheckin);
    sheet.querySelector("#checkin-sheet-title").textContent = "แก้ไข Check-in";
    sheet.querySelector("#checkin-save-label").textContent = "บันทึกการแก้ไข";
  });

  setTimeout(() => sheet.querySelector('[name="weight"]')?.focus(), 80);
}

function editorMarkup(checkin) {
  return `
    <section class="clob-checkin-sheet" role="dialog" aria-modal="true" aria-labelledby="checkin-sheet-title">
      <div class="clob-sheet-handle" aria-hidden="true"></div>
      <header class="clob-sheet-header">
        <div>
          <p class="clob-kicker">PROGRESS CHECK-IN</p>
          <h2 id="checkin-sheet-title">${checkin.id ? "แก้ไข Check-in" : "บันทึกข้อมูลวันนี้"}</h2>
          <p>ใส่เฉพาะข้อมูลที่วัดได้จริง ไม่จำเป็นต้องกรอกครบทุกช่อง</p>
        </div>
        <button id="checkin-sheet-close" aria-label="ปิด">×</button>
      </header>

      <form id="member-checkin-form" novalidate>
        <label class="clob-checkin-field is-date">
          <span>วันที่</span>
          <input name="date" type="date" required value="${escapeHtml(checkin.date)}">
        </label>

        <section class="clob-checkin-core">
          ${numberField("weight", "น้ำหนัก", "kg", checkin.weight, "0.1", true)}
          ${numberField("bodyFat", "Body Fat", "%", checkin.bodyFat)}
          ${numberField("waist", "รอบเอว", "cm", checkin.waist)}
        </section>

        <details class="clob-checkin-more">
          <summary>เพิ่มข้อมูลสัดส่วนอื่น ๆ <span>＋</span></summary>
          <div class="clob-checkin-more-grid">
            ${numberField("skeletalMuscle", "กล้ามเนื้อ", "kg", checkin.skeletalMuscle)}
            ${numberField("chest", "รอบอก", "cm", checkin.chest)}
            ${numberField("hip", "รอบสะโพก", "cm", checkin.hip)}
            ${numberField("arm", "รอบแขน", "cm", checkin.arm)}
            ${numberField("thigh", "รอบต้นขา", "cm", checkin.thigh)}
          </div>
        </details>

        <label class="clob-checkin-field is-note">
          <span>หมายเหตุ</span>
          <textarea name="note" rows="3" placeholder="เช่น ชั่งตอนเช้าก่อนอาหาร">${escapeHtml(checkin.note || "")}</textarea>
        </label>

        <div id="checkin-form-error" class="clob-checkin-error" hidden></div>

        <button id="checkin-save" class="clob-checkin-save" type="submit">
          <span id="checkin-save-label">${checkin.id ? "บันทึกการแก้ไข" : "บันทึก Check-in"}</span>
          <span aria-hidden="true">✓</span>
        </button>
      </form>
    </section>
  `;
}

function numberField(name, label, unit, value, step = "0.1", autofocus = false) {
  return `
    <label class="clob-checkin-field">
      <span>${escapeHtml(label)}</span>
      <div class="clob-metric-input">
        <input
          name="${escapeHtml(name)}"
          type="number"
          inputmode="decimal"
          min="0"
          step="${escapeHtml(step)}"
          value="${escapeHtml(value ?? "")}"
          ${autofocus ? "autofocus" : ""}
        >
        <small>${escapeHtml(unit)}</small>
      </div>
    </label>
  `;
}

async function saveEditor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const errorBox = form.querySelector("#checkin-form-error");
  const saveButton = form.querySelector("#checkin-save");
  const date = String(data.get("date") || "");

  if (!date) {
    showFormError(errorBox, "กรุณาเลือกวันที่");
    return;
  }

  const values = Object.fromEntries(
    numericFields.map((field) => [field, cleanNumber(data.get(field))])
  );
  if (numericFields.every((field) => values[field] === "")) {
    showFormError(errorBox, "กรุณากรอกอย่างน้อย 1 ค่า เช่น น้ำหนัก Body Fat หรือรอบเอว");
    return;
  }

  const existingOnDate = findByDate(date);
  const base = existingOnDate && existingOnDate.id !== editingCheckin.id
    ? existingOnDate
    : editingCheckin;

  saveButton.disabled = true;
  saveButton.querySelector("#checkin-save-label").textContent = "กำลังบันทึก...";

  try {
    const saved = await saveCheckin(code, {
      ...base,
      ...values,
      date,
      note: String(data.get("note") || "").trim()
    });

    const index = checkins.findIndex((item) => item.id === saved.id);
    if (index >= 0) checkins[index] = saved;
    else checkins.push(saved);
    sortCheckins();

    document.querySelector("#member-checkin-sheet").hidden = true;
    document.body.classList.remove("clob-sheet-open");
    render();
    toast(existingOnDate || editingCheckin.id ? "อัปเดต Check-in แล้ว" : "บันทึก Check-in แล้ว");
  } catch (error) {
    saveButton.disabled = false;
    saveButton.querySelector("#checkin-save-label").textContent = "ลองบันทึกอีกครั้ง";
    showFormError(errorBox, error?.message || "ไม่สามารถบันทึก Check-in ได้");
  }
}

function fillEditor(form, checkin) {
  ["date", ...numericFields, "note"].forEach((field) => {
    const input = form.elements.namedItem(field);
    if (input) input.value = checkin[field] ?? "";
  });
}

function bottomNav() {
  return `
    <nav class="bottom-nav" aria-label="เมนูสมาชิก">
      <button class="nav-item" data-member-nav="home"><span>⌂</span><small>Home</small></button>
      <button class="nav-item" data-member-nav="workout"><span>✦</span><small>Workout</small></button>
      <button class="nav-item is-active"><span>↗</span><small>Progress</small></button>
      <button class="nav-item" data-member-nav="profile"><span>○</span><small>Profile</small></button>
    </nav>
  `;
}

function openPhotos() {
  navigate(`/progress-photos-${code}`);
}

function findByDate(date) {
  return checkins.find((item) => item.date === date) || null;
}

function sortCheckins() {
  checkins.sort((a, b) => {
    const dateDelta = new Date(b.date || 0) - new Date(a.date || 0);
    return dateDelta || Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
  });
}

function trendText(change, count) {
  if (!count) return "บันทึกครั้งแรกเพื่อเริ่มเห็นความเปลี่ยนแปลง";
  if (change === null) return "ต้องมีอย่างน้อย 2 Check-ins เพื่อดูแนวโน้ม";
  if (change === 0) return "คงที่จาก Check-in แรก";
  return `${change > 0 ? "+" : ""}${change} kg จาก Check-in แรก`;
}

function formatDate(value) {
  if (!value) return "ไม่ระบุวันที่";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit"
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : "";
}

function filterPhotoSets(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => {
      return Object.values(item?.photos || {}).some((photo) => Boolean(photo?.url));
    })
  );
}

function showFormError(element, message) {
  element.hidden = false;
  element.textContent = message;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toast(message) {
  const element = document.querySelector("#progress-toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  setTimeout(() => {
    element.hidden = true;
  }, 1800);
}

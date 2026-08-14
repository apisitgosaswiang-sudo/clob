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
import { drawLineChart } from "./progress-charts.js";
import { loadPRs, latestPRsByExercise } from "./prs.js";
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
let activeChart = "weight";
let prs = [];
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

  [member, checkins, photoSets, prs] = await Promise.all([
    loadMember(code),
    loadCheckins(code),
    getProgressPhotoSets(code),
    loadPRs(code)
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
  const weeklyStreak = calculateWeeklyCheckinStreak(checkins);
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
          ${metricMarkup("Waist", formatMetric(waist, "นิ้ว"), waist === null ? "ยังไม่มีข้อมูล" : "ล่าสุด")}
          ${metricMarkup("Photos", String(photosCount), photosCount === 1 ? "Set" : "Sets", "photos")}
        </section>

        ${shareWinsMarkup({ weight, weightChange, weeklyStreak, photosCount })}

        <section class="clob-progress-section" aria-labelledby="chart-title">
          <div class="clob-progress-section-head">
            <div>
              <p class="clob-kicker">แนวโน้ม</p>
              <h2 id="chart-title">กราฟความก้าวหน้า</h2>
            </div>
          </div>

          <div class="member-chart-tabs">
            <button data-chart="weight" class="${activeChart === "weight" ? "is-active" : ""}">น้ำหนัก</button>
            <button data-chart="bodyFat" class="${activeChart === "bodyFat" ? "is-active" : ""}">Body Fat</button>
            <button data-chart="waist" class="${activeChart === "waist" ? "is-active" : ""}">รอบเอว</button>
          </div>

          <div class="member-chart-wrap">
            <canvas id="member-progress-chart" height="200"></canvas>
          </div>
        </section>

        ${prs.length ? `
          <section class="clob-progress-section" aria-labelledby="pr-title">
            <div class="clob-progress-section-head">
              <div>
                <p class="clob-kicker">สถิติส่วนตัว</p>
                <h2 id="pr-title">Personal Records</h2>
              </div>
              <span>${prs.length}</span>
            </div>
            <div class="member-pr-list">
              ${latestPRsByExercise(prs).slice(0, 6).map((pr) => `
                <div class="member-pr-item">
                  <span>${escapeHtml(pr.exercise)}</span>
                  <strong>${Number(pr.weight)} kg${Number(pr.reps) > 0 ? ` × ${Number(pr.reps)}` : ""}</strong>
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}

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


function shareWinsMarkup({ weight, weightChange, weeklyStreak, photosCount }) {
  const changeText = weightChange === null
    ? "STARTING LINE"
    : `${weightChange > 0 ? "+" : ""}${weightChange} KG`;
  const progressCaption = weightChange === null
    ? "Every check-in builds the story."
    : weightChange < 0 ? "Built through consistency." : "Still showing up.";
  return `
    <section class="mw-win-section" aria-labelledby="mw-win-title">
      <div class="mw-win-head">
        <div><p class="clob-kicker">SHARE YOUR WIN</p><h2 id="mw-win-title">Made to be shared.</h2></div>
        <span>Story-ready</span>
      </div>
      <div class="mw-win-scroll">
        <article class="mw-win-card mw-win-card-progress">
          <div class="mw-win-brand"><span>MW</span><strong>MORNING WARRIOR</strong></div>
          <p>MY PROGRESS</p>
          <strong class="mw-win-number">${escapeHtml(changeText)}</strong>
          <span class="mw-win-sub">${escapeHtml(progressCaption)}</span>
          <div class="mw-win-meta">
            <span><b>${escapeHtml(formatMetric(weight, "kg"))}</b> Latest</span>
            <span><b>${checkins.length}</b> Check-ins</span>
          </div>
          <button type="button" data-share-win="progress">Share Progress ↗</button>
        </article>
        <article class="mw-win-card mw-win-card-streak">
          <div class="mw-win-brand"><span>🔥</span><strong>MORNING WARRIOR</strong></div>
          <p>CONSISTENCY</p>
          <strong class="mw-win-number">${weeklyStreak}</strong>
          <span class="mw-win-sub">WEEK${weeklyStreak === 1 ? "" : "S"} CHECK-IN STREAK</span>
          <div class="mw-win-meta">
            <span><b>${photosCount}</b> Photo sets</span>
            <span><b>${checkins.length}</b> Total updates</span>
          </div>
          <button type="button" data-share-win="streak">Share Streak ↗</button>
        </article>
      </div>
      <p class="mw-win-hint">แคปการ์ดได้เลย หรือกด Share เพื่อสร้างภาพ Story 9:16</p>
    </section>
  `;
}

function calculateWeeklyCheckinStreak(items) {
  const weekStarts = [...new Set((items || []).map((item) => weekStartKey(item.date)).filter(Boolean))]
    .map((value) => new Date(`${value}T00:00:00`))
    .sort((a, b) => b - a);
  if (!weekStarts.length) return 0;
  let streak = 1;
  for (let i = 1; i < weekStarts.length; i += 1) {
    const diffDays = Math.round((weekStarts[i - 1] - weekStarts[i]) / 86400000);
    if (diffDays === 7) streak += 1;
    else break;
  }
  return streak;
}

function weekStartKey(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return todayKey(date);
}

async function shareWin(type) {
  const weight = latestValue(checkins, "weight");
  const change = calculateChange(checkins, "weight");
  const streak = calculateWeeklyCheckinStreak(checkins);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, "#111113");
  gradient.addColorStop(.58, "#18181b");
  gradient.addColorStop(1, "#2a0d15");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = "#e11d48";
  ctx.fillRect(78, 100, 16, 94);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Arial, sans-serif";
  ctx.fillText("MORNING WARRIOR", 126, 155);
  ctx.fillStyle = "rgba(255,255,255,.58)";
  ctx.font = "600 28px Arial, sans-serif";
  ctx.fillText(type === "streak" ? "CONSISTENCY" : "MY PROGRESS", 82, 410);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 150px Arial, sans-serif";
  const hero = type === "streak"
    ? String(streak)
    : (change === null ? "DAY ONE" : `${change > 0 ? "+" : ""}${change} KG`);
  ctx.fillText(hero, 78, 610);

  ctx.fillStyle = "#fb7185";
  ctx.font = "700 42px Arial, sans-serif";
  ctx.fillText(type === "streak" ? `WEEK${streak === 1 ? "" : "S"} CHECK-IN STREAK` : "PROGRESS, NOT PERFECTION.", 82, 690);

  ctx.fillStyle = "rgba(255,255,255,.08)";
  roundRect(ctx, 78, 880, 924, 420, 44);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "600 30px Arial, sans-serif";
  ctx.fillText("LATEST WEIGHT", 130, 1000);
  ctx.fillText("CHECK-INS", 590, 1000);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 68px Arial, sans-serif";
  ctx.fillText(weight === null ? "—" : `${weight} kg`, 130, 1100);
  ctx.fillText(String(checkins.length), 590, 1100);

  ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.font = "500 34px Arial, sans-serif";
  ctx.fillText("Quiet work. Visible progress.", 82, 1570);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText(member?.name ? String(member.name).toUpperCase() : "MORNING WARRIOR", 82, 1660);
  ctx.fillStyle = "#e11d48";
  ctx.fillRect(82, 1710, 180, 8);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", .96));
  if (!blob) return;
  const file = new File([blob], `morning-warrior-${type}.png`, { type: "image/png" });
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title: "Morning Warrior", text: "Progress, not perfection." });
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("สร้างภาพ Story แล้ว");
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
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
        <p>บันทึกน้ำหนัก Body Fat หรือรอบเอว แล้ว Morning Warrior จะสร้าง Timeline ให้คุณ</p>
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
              ? `Waist ${formatMetric(item.waist, "นิ้ว")}`
              : escapeHtml(item.note || "Progress update")}
        </span>
      </span>
      <span class="clob-timeline-edit">แก้ไข</span>
    </button>
  `).join("");
}

// วาดกราฟแนวโน้มจากข้อมูล check-in ที่มี (ใช้ตัววาดเดียวกับฝั่งเทรนเนอร์)
function drawMemberChart() {
  const canvas = document.querySelector("#member-progress-chart");
  if (!canvas) return;

  const points = [...checkins]
    .reverse()
    .filter((item) => item[activeChart] !== "" && Number.isFinite(Number(item[activeChart])))
    .map((item) => ({
      label: new Intl.DateTimeFormat("th-TH", { month: "short", day: "2-digit" })
        .format(new Date(`${item.date}T00:00:00`)),
      value: Number(item[activeChart])
    }));

  drawLineChart(canvas, points);
}

function bind() {
  drawMemberChart();

  document.querySelectorAll("[data-chart]").forEach((button) => {
    button.addEventListener("click", () => {
      activeChart = button.dataset.chart;
      render();
    });
  });

  document.querySelector("#progress-back").addEventListener("click", () => navigate("/member"));
  document.querySelector("#progress-profile").addEventListener("click", () => navigate("/member-profile"));
  document.querySelector("#member-checkin-action").addEventListener("click", () => {
    openEditor(findByDate(todayKey()));
  });
  document.querySelector("#empty-checkin-action")?.addEventListener("click", () => openEditor());
  document.querySelector("#progress-photos").addEventListener("click", openPhotos);
  document.querySelector('[data-progress-action="photos"]')?.addEventListener("click", openPhotos);

  document.querySelectorAll("[data-share-win]").forEach((button) => {
    button.addEventListener("click", () => shareWin(button.dataset.shareWin));
  });

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
      if (target === "nutrition") navigate("/nutrition");
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
          ${numberField("waist", "รอบเอว", "นิ้ว", checkin.waist)}
        </section>

        <details class="clob-checkin-more">
          <summary>เพิ่มข้อมูลสัดส่วนอื่น ๆ <span>＋</span></summary>
          <div class="clob-checkin-more-grid">
            ${numberField("skeletalMuscle", "กล้ามเนื้อ", "kg", checkin.skeletalMuscle)}
            ${numberField("chest", "รอบอก", "นิ้ว", checkin.chest)}
            ${numberField("hip", "รอบสะโพก", "นิ้ว", checkin.hip)}
            ${numberField("arm", "รอบแขน", "นิ้ว", checkin.arm)}
            ${numberField("thigh", "รอบต้นขา", "นิ้ว", checkin.thigh)}
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

const FIELD_MAX = { weight: 300, bodyFat: 60, skeletalMuscle: 100, chest: 100, waist: 100, hip: 100, arm: 50, thigh: 60 };

function numberField(name, label, unit, value, step = "0.1", autofocus = false) {
  const max = FIELD_MAX[name] || 999;
  return `
    <label class="clob-checkin-field">
      <span>${escapeHtml(label)}</span>
      <div class="clob-metric-input">
        <input
          name="${escapeHtml(name)}"
          type="number"
          inputmode="decimal"
          min="0"
          max="${max}"
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
      <button class="nav-item" data-member-nav="nutrition"><span>◒</span><small>Nutrition</small></button>
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

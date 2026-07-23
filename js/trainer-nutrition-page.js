import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import {
  dateKey,
  loadNutritionDay,
  loadTrainerNutritionFeedback,
  mealTypeLabel,
  normalizeMeal,
  saveMeal,
  saveTrainerNutritionFeedback,
  setNutritionTarget
} from "./nutrition.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");
let member = null;
let today = null;
let week = [];
let reviewDay = null;
let feedback = {};

export async function renderTrainerNutritionPage(memberCode) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  app.innerHTML = loadingMarkup();
  const members = await loadMembers();
  member = getMemberByCode(members, memberCode);
  if (!member) {
    navigate("/members");
    return;
  }

  const dates = previousDateKeys(7);
  week = await Promise.all(dates.map((key) => loadNutritionDay(memberCode, key)));
  today = week[0];
  reviewDay = today;
  feedback = await loadTrainerNutritionFeedback(memberCode, reviewDay.date);
  render();
}

function render() {
  const target = today.target;
  const summary = reviewDay.summary;
  const adherence = weeklyAdherence(week);

  app.innerHTML = `
    <main class="page trainer-page clob-trainer-nutrition">
      <div class="clob-trainer-nutrition-shell">
        <header class="member-detail-header">
          <button id="trainer-nutrition-back" class="back-button" aria-label="กลับ">←</button>
          <div>
            <p class="section-label">MEMBER NUTRITION</p>
            <h1>${escapeHtml(member.name)}</h1>
          </div>
          <span class="clob-status ${target ? "is-success" : ""}">${target ? "TARGET READY" : "NO TARGET"}</span>
        </header>

        <section class="clob-trainer-nutrition-summary">
          <article class="card">
            <span>Calories ${reviewDay.date === dateKey() ? "วันนี้" : formatDate(reviewDay.date)}</span>
            <strong>${formatNumber(summary.calories)} <small>/ ${reviewDay.target ? formatNumber(reviewDay.target.calories) : "—"} kcal</small></strong>
          </article>
          <article class="card">
            <span>Protein ${reviewDay.date === dateKey() ? "วันนี้" : formatDate(reviewDay.date)}</span>
            <strong>${formatNumber(summary.protein)} <small>/ ${reviewDay.target ? formatNumber(reviewDay.target.protein) : "—"} g</small></strong>
          </article>
        </section>

        <label class="clob-trainer-review-date">
          <span>วันที่ตรวจอาหาร</span>
          <input id="trainer-review-date" type="date" value="${escapeHtml(reviewDay.date)}" min="${escapeHtml(recentDateKey(14))}" max="${escapeHtml(dateKey())}">
        </label>

        <section class="detail-card card clob-target-card">
          <div class="detail-card-title">
            <div>
              <h2>${target ? "เป้าหมายปัจจุบัน" : "ตั้งเป้าหมาย Nutrition"}</h2>
              <p>${target ? `เริ่มใช้ ${formatDate(target.effectiveFrom)}` : "สมาชิกจะเห็น Calories Remaining หลังบันทึก"}</p>
            </div>
            ${target ? `<span class="package-chip package-active">ACTIVE</span>` : ""}
          </div>

          <form id="nutrition-target-form" class="clob-target-form" novalidate>
            <label>
              <span>Calories / วัน</span>
              <div><input name="calories" type="number" inputmode="numeric" min="1" step="1" required value="${escapeHtml(target?.calories || "")}" placeholder="2000"><small>kcal</small></div>
            </label>
            <label>
              <span>Protein / วัน</span>
              <div><input name="protein" type="number" inputmode="decimal" min="0" step="0.1" value="${escapeHtml(target?.protein ?? "")}" placeholder="140"><small>g</small></div>
            </label>
            <label class="is-wide">
              <span>เริ่มใช้ตั้งแต่วันที่</span>
              <input name="effectiveFrom" type="date" required value="${escapeHtml(dateKey())}">
            </label>
            <div id="nutrition-target-error" class="clob-nutrition-error is-wide" hidden></div>
            <button id="save-nutrition-target" class="button button-primary is-wide" type="submit">
              ${target ? "บันทึกเป้าหมายใหม่" : "ตั้งเป้าหมาย"}
            </button>
          </form>
          ${target ? `<small class="clob-target-history-note">การบันทึกจะสร้างเป้าหมายใหม่ตามวันที่เริ่มใช้ โดยไม่แก้ข้อมูลย้อนหลัง</small>` : ""}
        </section>

        <section class="detail-card card">
          <div class="clob-trainer-section-head">
            <div>
              <p class="section-label">7-DAY ADHERENCE</p>
              <h2>ภาพรวม 7 วัน</h2>
            </div>
            <strong>${adherence.loggedDays ? `${adherence.onTargetDays}/${adherence.loggedDays}` : "—"}</strong>
          </div>
          <div class="clob-adherence-list">
            ${week.map(adherenceDayMarkup).join("")}
          </div>
          <p class="clob-target-history-note">วันที่ไม่มีรายการอาหารแสดงเป็น “ไม่มีข้อมูล” และไม่นับเป็นรับประทาน 0 kcal</p>
        </section>

        <section class="detail-card card">
          <div class="clob-trainer-section-head">
            <div>
              <p class="section-label">TODAY'S MEALS</p>
              <h2>อาหาร${reviewDay.date === dateKey() ? "วันนี้" : ` ${formatDate(reviewDay.date)}`}</h2>
            </div>
            <span>${reviewDay.meals.length} รายการ</span>
          </div>
          <div class="clob-trainer-meal-list">
            ${reviewDay.meals.length ? reviewDay.meals.map(trainerMealMarkup).join("") : `
              <div class="clob-trainer-meal-empty">สมาชิกยังไม่ได้บันทึกอาหารในวันที่เลือก</div>
            `}
          </div>
        </section>

        <div id="trainer-nutrition-sheet" class="clob-sheet-backdrop" hidden></div>
        <div id="trainer-nutrition-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  document.querySelector("#trainer-nutrition-back").addEventListener("click", () => {
    navigate(`/member-detail-${member.code}`);
  });
  document.querySelector("#nutrition-target-form").addEventListener("submit", saveTargetForm);
  document.querySelector("#trainer-review-date").addEventListener("change", changeReviewDate);
  document.querySelectorAll("[data-trainer-edit-meal]").forEach((button) => {
    button.addEventListener("click", () => {
      const meal = reviewDay.meals.find((item) => item.id === button.dataset.trainerEditMeal);
      if (meal) openTrainerMealEditor(meal);
    });
  });
}

async function saveTargetForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const errorBox = form.querySelector("#nutrition-target-error");
  const button = form.querySelector("#save-nutrition-target");
  const calories = Number(data.get("calories"));
  const protein = String(data.get("protein") || "").trim() === ""
    ? 0
    : Number(data.get("protein"));
  const effectiveFrom = String(data.get("effectiveFrom") || "");

  if (!Number.isFinite(calories) || calories <= 0) {
    showError(errorBox, "กรุณากำหนด Calories มากกว่า 0");
    return;
  }
  if (!Number.isFinite(protein) || protein < 0) {
    showError(errorBox, "Protein ต้องไม่ติดลบ");
    return;
  }
  if (!effectiveFrom) {
    showError(errorBox, "กรุณาเลือกวันที่เริ่มใช้");
    return;
  }

  button.disabled = true;
  button.textContent = "กำลังบันทึก...";
  errorBox.hidden = true;

  try {
    await setNutritionTarget(member.code, {
      calories,
      protein,
      carbs: null,
      fat: null,
      effectiveFrom
    });
    const dates = previousDateKeys(7);
    week = await Promise.all(dates.map((key) => loadNutritionDay(member.code, key)));
    today = week[0];
    reviewDay = await loadNutritionDay(member.code, reviewDay.date);
    render();
    toast("บันทึกเป้าหมาย Nutrition แล้ว");
  } catch (error) {
    button.disabled = false;
    button.textContent = "ลองบันทึกอีกครั้ง";
    showError(errorBox, error.message || "บันทึกเป้าหมายไม่สำเร็จ");
  }
}

function adherenceDayMarkup(day) {
  const target = day.target;
  const hasMeals = day.meals.length > 0;
  const ratio = target && target.calories > 0
    ? day.summary.calories / target.calories
    : null;
  let status = "ไม่มีข้อมูล";
  let tone = "is-empty";

  if (hasMeals && ratio !== null) {
    const delta = Math.abs(1 - ratio);
    if (delta <= 0.1) {
      status = "ตามเป้าหมาย";
      tone = "is-success";
    } else if (delta <= 0.2) {
      status = "ใกล้เป้าหมาย";
      tone = "is-near";
    } else {
      status = "ควรทบทวน";
      tone = "is-review";
    }
  } else if (hasMeals && !target) {
    status = "ยังไม่มีเป้าหมาย";
  }

  return `
    <div class="clob-adherence-day">
      <span>${escapeHtml(shortDate(day.date))}</span>
      <strong>${hasMeals ? `${formatNumber(day.summary.calories)} kcal` : "—"}</strong>
      <em class="${tone}">${status}</em>
    </div>
  `;
}

function trainerMealMarkup(meal) {
  const coachFeedback = feedback[meal.id]?.message || "";
  return `
    <button data-trainer-edit-meal="${escapeHtml(meal.id)}">
      <div>
        <span>${escapeHtml(mealTypeLabel(meal.mealType))}${meal.source === "ai" ? " · AI" : ""}</span>
        <strong>${escapeHtml(meal.name)}</strong>
        <small>P ${formatNumber(meal.final.protein)} · C ${formatNumber(meal.final.carbs)} · F ${formatNumber(meal.final.fat)} g</small>
        ${coachFeedback ? `<em>Coach: ${escapeHtml(coachFeedback)}</em>` : ""}
      </div>
      <strong>${formatNumber(meal.final.calories)} <small>kcal</small></strong>
    </button>
  `;
}

async function changeReviewDate(event) {
  const selectedDate = event.currentTarget.value;
  if (!selectedDate) return;
  app.querySelector("#trainer-review-date").disabled = true;
  [reviewDay, feedback] = await Promise.all([
    loadNutritionDay(member.code, selectedDate),
    loadTrainerNutritionFeedback(member.code, selectedDate)
  ]);
  render();
}

function openTrainerMealEditor(meal) {
  const value = normalizeMeal(meal, meal.id);
  const sheet = document.querySelector("#trainer-nutrition-sheet");
  const coachFeedback = feedback[value.id]?.message || "";
  sheet.hidden = false;
  sheet.innerHTML = `
    <section class="clob-nutrition-sheet is-form" role="dialog" aria-modal="true" aria-labelledby="trainer-meal-editor-title">
      <div class="clob-sheet-handle" aria-hidden="true"></div>
      <header class="clob-sheet-header">
        <div>
          <p class="clob-kicker">TRAINER REVIEW</p>
          <h2 id="trainer-meal-editor-title">ตรวจและแก้ไขอาหาร</h2>
          <p>ค่าที่เทรนเนอร์บันทึกจะอัปเดต Calories Remaining ของสมาชิกทันที</p>
        </div>
        <button id="trainer-meal-close" aria-label="ปิด">×</button>
      </header>
      <form id="trainer-meal-form" class="clob-meal-form" novalidate>
        <label class="is-wide">
          <span>ชื่ออาหาร</span>
          <input name="name" required maxlength="100" value="${escapeHtml(value.name)}">
        </label>
        <label class="is-wide">
          <span>มื้ออาหาร</span>
          <select name="mealType">
            ${trainerMealTypeOptions(value.mealType)}
          </select>
        </label>
        ${trainerNutritionInput("calories", "Calories", "kcal", value.final.calories)}
        ${trainerNutritionInput("protein", "Protein", "g", value.final.protein)}
        ${trainerNutritionInput("carbs", "Carbs", "g", value.final.carbs)}
        ${trainerNutritionInput("fat", "Fat", "g", value.final.fat)}
        <label class="is-wide">
          <span>Feedback ถึงสมาชิก</span>
          <textarea name="feedback" rows="3" maxlength="240" placeholder="เช่น มื้อนี้ดีครับ เพิ่มผักอีกเล็กน้อย">${escapeHtml(coachFeedback)}</textarea>
        </label>
        <div id="trainer-meal-error" class="clob-nutrition-error is-wide" hidden></div>
        <button id="trainer-meal-save" class="clob-nutrition-save is-wide" type="submit">
          <span>บันทึกการตรวจอาหาร</span>
          <span aria-hidden="true">✓</span>
        </button>
      </form>
    </section>
  `;
  document.body.classList.add("clob-sheet-open");
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) closeTrainerMealEditor();
  });
  sheet.querySelector("#trainer-meal-close").addEventListener("click", closeTrainerMealEditor);
  sheet.querySelector("#trainer-meal-form").addEventListener("submit", (event) => {
    saveTrainerMealEditor(event, value);
  });
}

async function saveTrainerMealEditor(event, meal) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector("#trainer-meal-save");
  const errorBox = form.querySelector("#trainer-meal-error");
  const name = String(data.get("name") || "").trim();
  const calories = Number(data.get("calories"));
  if (!name) {
    showError(errorBox, "กรุณากรอกชื่ออาหาร");
    return;
  }
  if (!Number.isFinite(calories) || calories < 0) {
    showError(errorBox, "Calories ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
    return;
  }

  button.disabled = true;
  button.querySelector("span").textContent = "กำลังบันทึก...";
  errorBox.hidden = true;
  try {
    await saveMeal(member.code, reviewDay.date, {
      ...meal,
      name,
      mealType: String(data.get("mealType") || "meal"),
      updatedBy: "trainer",
      final: {
        calories,
        protein: Number(data.get("protein") || 0),
        carbs: Number(data.get("carbs") || 0),
        fat: Number(data.get("fat") || 0)
      }
    });
    await saveTrainerNutritionFeedback(
      member.code,
      reviewDay.date,
      meal.id,
      String(data.get("feedback") || "")
    );
    [reviewDay, feedback] = await Promise.all([
      loadNutritionDay(member.code, reviewDay.date),
      loadTrainerNutritionFeedback(member.code, reviewDay.date)
    ]);
    const index = week.findIndex((item) => item.date === reviewDay.date);
    if (index >= 0) week[index] = reviewDay;
    if (reviewDay.date === dateKey()) today = reviewDay;
    closeTrainerMealEditor();
    render();
    toast("อัปเดตอาหารและ Feedback แล้ว");
  } catch (error) {
    button.disabled = false;
    button.querySelector("span").textContent = "ลองบันทึกอีกครั้ง";
    showError(errorBox, error.message || "บันทึกการตรวจอาหารไม่สำเร็จ");
  }
}

function closeTrainerMealEditor() {
  const sheet = document.querySelector("#trainer-nutrition-sheet");
  if (sheet) sheet.hidden = true;
  document.body.classList.remove("clob-sheet-open");
}

function trainerNutritionInput(name, label, unit, value) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <div class="clob-nutrition-input">
        <input name="${escapeHtml(name)}" type="number" inputmode="decimal" min="0" step="0.1" value="${escapeHtml(value ?? 0)}">
        <small>${escapeHtml(unit)}</small>
      </div>
    </label>
  `;
}

function trainerMealTypeOptions(selected) {
  return [
    ["breakfast", "มื้อเช้า"],
    ["lunch", "มื้อกลางวัน"],
    ["dinner", "มื้อเย็น"],
    ["snack", "ของว่าง"]
  ].map(([value, label]) => `
    <option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>
  `).join("");
}

function weeklyAdherence(days) {
  const logged = days.filter((day) => day.meals.length && day.target);
  const onTarget = logged.filter((day) => {
    return Math.abs(1 - (day.summary.calories / Math.max(1, day.target.calories))) <= 0.1;
  });
  return {
    loggedDays: logged.length,
    onTargetDays: onTarget.length
  };
}

function previousDateKeys(count) {
  return Array.from({ length: count }, (_, index) => {
    const value = new Date();
    value.setDate(value.getDate() - index);
    return dateKey(value);
  });
}

function loadingMarkup() {
  return `
    <main class="page trainer-page">
      <section class="trainer-loading">
        <div class="loading-spinner"></div>
        <p>กำลังโหลด Nutrition...</p>
      </section>
    </main>
  `;
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function toast(message) {
  const element = document.querySelector("#trainer-nutrition-toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  setTimeout(() => { element.hidden = true; }, 2200);
}

function shortDate(value) {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      weekday: "short",
      day: "numeric",
      month: "short"
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    maximumFractionDigits: number % 1 ? 1 : 0
  });
}

function recentDateKey(days) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return dateKey(value);
}

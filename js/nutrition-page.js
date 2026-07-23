import { navigate } from "./router.js";
import { loadMember } from "./member.js";
import {
  dateKey,
  getAiQuotaState,
  loadNutritionDay,
  loadRecentFoods,
  loadTrainerNutritionFeedback,
  mealTypeLabel,
  normalizeMeal,
  removeMeal,
  saveMeal
} from "./nutrition.js";
import { estimateFoodPhoto, prepareFoodPhoto } from "./ai-food-estimator.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");
let code = "";
let member = null;
let day = null;
let recentFoods = [];
let quota = null;
let feedback = {};
let editingMeal = null;
let aiEstimate = null;
let preparedPhoto = null;

export async function renderNutritionPage() {
  code = sessionStorage.getItem("clob_member_code");
  if (!code) {
    navigate("/");
    return;
  }

  app.innerHTML = loadingMarkup();
  const selectedDate = sessionStorage.getItem("clob_nutrition_date") || dateKey();
  [member, day, recentFoods, quota, feedback] = await Promise.all([
    loadMember(code),
    loadNutritionDay(code, selectedDate),
    loadRecentFoods(code),
    getAiQuotaState(code, dateKey()),
    loadTrainerNutritionFeedback(code, selectedDate)
  ]);
  render();
}

function render() {
  const summary = day.summary;
  const target = day.target;
  const remaining = summary.remainingCalories;
  const calorieTone = !target
    ? "is-empty"
    : remaining < 0
      ? "is-over"
      : remaining <= 100
        ? "is-critical"
        : remaining <= 250
          ? "is-near"
          : "";

  app.innerHTML = `
    <main class="page member-page clob-nutrition-page">
      <div class="clob-nutrition-shell">
        <header class="clob-nutrition-header">
          <button id="nutrition-back" class="clob-icon-button" aria-label="กลับหน้า Home">←</button>
          <div>
            <p class="clob-kicker">DAILY NUTRITION</p>
            <h1>Nutrition</h1>
          </div>
          <button id="nutrition-profile" class="avatar-button" aria-label="เปิดโปรไฟล์">
            ${renderAvatar({
              name: member.name,
              photoUrl: member.profilePhoto,
              className: "member-header-avatar"
            })}
          </button>
        </header>

        <label class="clob-nutrition-date">
          <span>วันที่บันทึก</span>
          <input
            id="nutrition-date"
            type="date"
            value="${escapeHtml(day.date)}"
            min="${escapeHtml(recentDateKey(14))}"
            max="${escapeHtml(dateKey())}"
          >
        </label>

        <section class="clob-nutrition-hero ${calorieTone}" aria-labelledby="nutrition-remaining-title">
          ${target ? `
            <div class="clob-nutrition-hero-label">
              <p class="clob-kicker">CALORIES REMAINING</p>
              <span>${day.date === dateKey() ? "วันนี้" : formatDate(day.date)}</span>
            </div>
            <div class="clob-nutrition-remaining">
              <span>${remaining < 0 ? "เกินเป้าหมาย" : "เหลือ"}</span>
              <strong id="nutrition-remaining-title">${Math.abs(Math.round(remaining)).toLocaleString("en-US")}</strong>
              <small>kcal</small>
            </div>
            <div class="clob-nutrition-progress" aria-label="รับประทานแล้ว ${caloriePercent(summary.calories, target.calories)}%">
              <span style="--nutrition-progress:${caloriePercent(summary.calories, target.calories)}%"></span>
            </div>
            <p>ทานแล้ว ${formatNumber(summary.calories)} / ${formatNumber(target.calories)} kcal</p>
          ` : `
            <p class="clob-kicker">NO TARGET YET</p>
            <h2>เทรนเนอร์ยังไม่ได้ตั้งเป้าหมาย</h2>
            <p>คุณยังบันทึกอาหารได้ตามปกติ และระบบจะเริ่มคำนวณ Calories Remaining เมื่อมีเป้าหมาย</p>
          `}
        </section>

        <section class="clob-nutrition-macros" aria-label="สารอาหารวันนี้">
          ${macroMarkup("Protein", summary.protein, target?.protein, "g")}
          ${macroMarkup("Carbs", summary.carbs, target?.carbs, "g")}
          ${macroMarkup("Fat", summary.fat, target?.fat, "g")}
        </section>

        <button id="add-meal-button" class="clob-nutrition-add">
          <span>
            <small>LOG A MEAL</small>
            <strong>เพิ่มอาหาร</strong>
          </span>
          <span aria-hidden="true">＋</span>
        </button>

        <section class="clob-nutrition-section" aria-labelledby="meal-timeline-title">
          <div class="clob-nutrition-section-head">
            <div>
              <p class="clob-kicker">MEAL TIMELINE</p>
              <h2 id="meal-timeline-title">${day.date === dateKey() ? "อาหารวันนี้" : formatDate(day.date)}</h2>
            </div>
            <span>${day.meals.length} รายการ</span>
          </div>
          <div class="clob-meal-timeline">
            ${mealTimelineMarkup()}
          </div>
        </section>

        <aside class="clob-ai-cost-note">
          <span aria-hidden="true">AI</span>
          <p>
            วิเคราะห์รูปเมื่อกดปุ่มเท่านั้น · เหลือ
            <strong>${Number(quota?.memberRemaining || 0)} ครั้ง</strong>
            วันนี้ · รูปไม่ถูกเก็บถาวร
          </p>
        </aside>

        <div id="nutrition-sheet" class="clob-sheet-backdrop" hidden></div>
        <div id="nutrition-toast" class="toast" role="status" hidden></div>
      </div>
      ${memberBottomNavMarkup()}
    </main>
  `;

  bind();
}

function macroMarkup(label, consumed, target, unit) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(consumed)} <small>${escapeHtml(unit)}</small></strong>
      <p>${target === null || target === undefined
        ? "บันทึกแล้ว"
        : `/ ${formatNumber(target)} ${escapeHtml(unit)}`}</p>
    </article>
  `;
}

function mealTimelineMarkup() {
  if (!day.meals.length) {
    return `
      <button id="empty-add-meal" class="clob-nutrition-empty">
        <span aria-hidden="true">＋</span>
        <strong>ยังไม่มีอาหารในวันนี้</strong>
        <p>เพิ่มมื้อแรกด้วยรูป รายการล่าสุด หรือกรอกเอง</p>
      </button>
    `;
  }

  return day.meals.map((meal) => `
    <button class="clob-meal-card" data-edit-meal="${escapeHtml(meal.id)}">
      <span class="clob-meal-type">${escapeHtml(mealTypeShort(meal.mealType))}</span>
      <span class="clob-meal-copy">
        <small>${escapeHtml(mealTypeLabel(meal.mealType))}${meal.source === "ai" ? " · AI estimate" : ""}</small>
        <strong>${escapeHtml(meal.name)}</strong>
        <span>P ${formatNumber(meal.final.protein)} · C ${formatNumber(meal.final.carbs)} · F ${formatNumber(meal.final.fat)} g</span>
        ${feedback[meal.id]?.message
          ? `<em>Coach: ${escapeHtml(feedback[meal.id].message)}</em>`
          : ""}
      </span>
      <span class="clob-meal-calories">
        <strong>${formatNumber(meal.final.calories)}</strong>
        <small>kcal</small>
      </span>
    </button>
  `).join("");
}

function bind() {
  document.querySelector("#nutrition-back").addEventListener("click", () => navigate("/member"));
  document.querySelector("#nutrition-profile").addEventListener("click", () => navigate("/member-profile"));
  document.querySelector("#add-meal-button").addEventListener("click", openAddChoices);
  document.querySelector("#empty-add-meal")?.addEventListener("click", openAddChoices);

  document.querySelector("#nutrition-date").addEventListener("change", async (event) => {
    const selected = event.currentTarget.value;
    if (!selected) return;
    sessionStorage.setItem("clob_nutrition_date", selected);
    [day, feedback] = await Promise.all([
      loadNutritionDay(code, selected),
      loadTrainerNutritionFeedback(code, selected)
    ]);
    render();
  });

  document.querySelectorAll("[data-edit-meal]").forEach((button) => {
    button.addEventListener("click", () => {
      editingMeal = day.meals.find((meal) => meal.id === button.dataset.editMeal) || null;
      aiEstimate = editingMeal?.ai || null;
      openMealForm(editingMeal);
    });
  });

  bindMemberNavigation();
}

function openAddChoices() {
  editingMeal = null;
  aiEstimate = null;
  clearPreparedPhoto();
  openSheet(`
    <section class="clob-nutrition-sheet" role="dialog" aria-modal="true" aria-labelledby="add-meal-title">
      ${sheetHeader("ADD FOOD", "เพิ่มอาหาร", "เลือกวิธีที่สะดวกที่สุด")}
      <div class="clob-add-methods">
        <button data-add-method="photo">
          <span class="is-ai">AI</span>
          <span><strong>ถ่ายหรือเลือกรูป</strong><small>AI ช่วยประเมิน Calories และ Macros</small></span>
          <span>→</span>
        </button>
        <button data-add-method="recent" ${recentFoods.length ? "" : "disabled"}>
          <span>↺</span>
          <span><strong>รายการล่าสุด</strong><small>${recentFoods.length ? "เลือกอาหารที่เคยยืนยันแล้ว" : "ยังไม่มีรายการล่าสุด"}</small></span>
          <span>→</span>
        </button>
        <button data-add-method="manual">
          <span>✎</span>
          <span><strong>กรอกเอง</strong><small>ใส่ชื่ออาหารและสารอาหารด้วยตัวเอง</small></span>
          <span>→</span>
        </button>
      </div>
      <p class="clob-sheet-footnote">การเลือกรูปยังไม่ใช้โควตา AI ระบบจะวิเคราะห์เมื่อคุณกดปุ่มยืนยันเท่านั้น</p>
    </section>
  `);

  document.querySelector('[data-add-method="photo"]').addEventListener("click", openPhotoFlow);
  document.querySelector('[data-add-method="recent"]')?.addEventListener("click", openRecentFoods);
  document.querySelector('[data-add-method="manual"]').addEventListener("click", () => openMealForm(null));
}

function openPhotoFlow() {
  openSheet(`
    <section class="clob-nutrition-sheet is-photo" role="dialog" aria-modal="true" aria-labelledby="photo-meal-title">
      ${sheetHeader("AI FOOD ESTIMATE", "ประเมินอาหารจากรูป", "AI จะให้ค่าประมาณและคุณแก้ไขได้ก่อนบันทึก")}
      <label class="clob-food-photo-picker" for="food-photo-input">
        <input id="food-photo-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment">
        <span id="food-photo-preview">
          <b>＋</b>
          <strong>ถ่ายหรือเลือกรูปอาหาร</strong>
          <small>เลือกรูปมื้ออาหารเพียง 1 รูป</small>
        </span>
      </label>
      <div id="food-photo-meta" class="clob-food-photo-meta" hidden></div>
      <div id="ai-food-error" class="clob-nutrition-error" hidden></div>
      <button id="analyze-food-button" class="clob-nutrition-save" type="button" disabled>
        <span>วิเคราะห์ด้วย AI · เหลือ ${Number(quota?.memberRemaining || 0)} ครั้ง</span>
        <span aria-hidden="true">AI</span>
      </button>
      <button id="manual-food-fallback" class="clob-sheet-secondary" type="button">กรอกเองแทน</button>
      <p class="clob-sheet-footnote">ค่าที่ได้เป็นการประเมินจากภาพ อาจไม่ทราบน้ำมัน ซอส น้ำตาล หรือวัตถุดิบที่ซ่อนอยู่</p>
    </section>
  `);

  document.querySelector("#food-photo-input").addEventListener("change", handlePhotoSelection);
  document.querySelector("#analyze-food-button").addEventListener("click", analyzeSelectedPhoto);
  document.querySelector("#manual-food-fallback").addEventListener("click", () => openMealForm(null));
}

async function handlePhotoSelection(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const errorBox = document.querySelector("#ai-food-error");
  const button = document.querySelector("#analyze-food-button");
  const preview = document.querySelector("#food-photo-preview");
  const meta = document.querySelector("#food-photo-meta");
  button.disabled = true;
  button.querySelector("span").textContent = "กำลังเตรียมรูป...";
  hideError(errorBox);

  try {
    clearPreparedPhoto();
    preparedPhoto = await prepareFoodPhoto(file);
    preview.innerHTML = `
      <img src="${preparedPhoto.previewUrl}" alt="รูปอาหารที่เลือก">
      <small>แตะเพื่อเลือกรูปใหม่</small>
    `;
    meta.hidden = false;
    meta.textContent = `บีบอัดแล้ว ${formatBytes(preparedPhoto.compressedBytes)} · ยังไม่ใช้โควตา AI`;
    button.disabled = Number(quota?.memberRemaining || 0) <= 0;
    button.querySelector("span").textContent = button.disabled
      ? "วันนี้ใช้ AI ครบแล้ว"
      : `วิเคราะห์ด้วย AI · เหลือ ${Number(quota.memberRemaining)} ครั้ง`;
  } catch (error) {
    showError(errorBox, error.message || "ไม่สามารถเตรียมรูปนี้ได้");
    button.disabled = true;
    button.querySelector("span").textContent = "เลือกรูปใหม่";
  }
}

async function analyzeSelectedPhoto() {
  if (!preparedPhoto) return;
  const button = document.querySelector("#analyze-food-button");
  const errorBox = document.querySelector("#ai-food-error");
  if (button.dataset.retry === "true" && !window.confirm("วิเคราะห์ใหม่จะใช้โควตา AI เพิ่มอีก 1 ครั้ง ต้องการดำเนินการต่อหรือไม่?")) {
    return;
  }
  button.disabled = true;
  delete button.dataset.retry;
  button.querySelector("span").textContent = "AI กำลังประเมิน...";
  hideError(errorBox);

  try {
    aiEstimate = await estimateFoodPhoto({
      memberCode: code,
      selectedDate: dateKey(),
      preparedPhoto
    });
    if (!aiEstimate.reused) {
      quota = await getAiQuotaState(code, dateKey());
    }
    openMealForm({
      name: aiEstimate.name,
      mealType: suggestedMealType(),
      source: "ai",
      ai: aiEstimate,
      imageFingerprint: aiEstimate.fingerprint,
      final: aiEstimate
    }, { isNewAi: true });
  } catch (error) {
    showError(errorBox, error.message || "AI วิเคราะห์ไม่สำเร็จ กรุณากรอกเอง");
    if (error?.clobCode === "AI_FAILED") {
      quota = await getAiQuotaState(code, dateKey());
      button.dataset.retry = "true";
      button.disabled = Number(quota?.memberRemaining || 0) <= 0;
      button.querySelector("span").textContent = button.disabled
        ? "วันนี้ใช้ AI ครบแล้ว"
        : "วิเคราะห์ใหม่ · ใช้โควตาเพิ่ม 1 ครั้ง";
    } else if (error?.clobCode === "AI_QUOTA") {
      quota = await getAiQuotaState(code, dateKey());
      button.disabled = !quota.available;
      button.querySelector("span").textContent = button.disabled
        ? "วันนี้ใช้ AI ครบแล้ว"
        : "ตรวจสอบโควตาอีกครั้ง";
    } else {
      button.disabled = false;
      button.querySelector("span").textContent = "ลองตรวจสอบ AI อีกครั้ง";
    }
  }
}

function openRecentFoods() {
  openSheet(`
    <section class="clob-nutrition-sheet" role="dialog" aria-modal="true" aria-labelledby="recent-food-title">
      ${sheetHeader("RECENT FOOD", "รายการล่าสุด", "เลือกแล้วตรวจสอบก่อนบันทึก")}
      <div class="clob-recent-food-list">
        ${recentFoods.slice(0, 12).map((food) => `
          <button data-recent-food="${escapeHtml(food.id)}">
            <span>
              <strong>${escapeHtml(food.name)}</strong>
              <small>P ${formatNumber(food.nutrition.protein)} · C ${formatNumber(food.nutrition.carbs)} · F ${formatNumber(food.nutrition.fat)} g</small>
            </span>
            <span><strong>${formatNumber(food.nutrition.calories)}</strong><small>kcal</small></span>
          </button>
        `).join("")}
      </div>
    </section>
  `);

  document.querySelectorAll("[data-recent-food]").forEach((button) => {
    button.addEventListener("click", () => {
      const food = recentFoods.find((item) => item.id === button.dataset.recentFood);
      if (!food) return;
      openMealForm({
        name: food.name,
        mealType: suggestedMealType(),
        source: "recent",
        final: food.nutrition
      });
    });
  });
}

function openMealForm(meal, { isNewAi = false } = {}) {
  const value = normalizeMeal(meal || {
    name: "",
    mealType: suggestedMealType(),
    source: "manual",
    final: { calories: 0, protein: 0, carbs: 0, fat: 0 }
  });
  const isEditing = Boolean(meal?.id);
  const hasAi = value.source === "ai" && (aiEstimate || value.ai);
  const estimate = aiEstimate || value.ai;

  editingMeal = value;
  openSheet(`
    <section class="clob-nutrition-sheet is-form" role="dialog" aria-modal="true" aria-labelledby="meal-form-title">
      ${sheetHeader(
        hasAi ? "AI RESULT" : isEditing ? "EDIT MEAL" : "MANUAL ENTRY",
        hasAi ? "ตรวจสอบค่าประเมิน" : isEditing ? "แก้ไขอาหาร" : "กรอกอาหาร",
        hasAi ? "แก้ไขทุกค่าได้ก่อนยืนยันบันทึก" : "Calories จำเป็น ส่วน Macro เว้นว่างได้"
      )}
      ${hasAi ? aiResultNote(estimate, isNewAi) : ""}
      <form id="nutrition-meal-form" class="clob-meal-form" novalidate>
        <label class="is-wide">
          <span>ชื่ออาหาร</span>
          <input name="name" required maxlength="100" value="${escapeHtml(value.name)}" placeholder="เช่น ข้าวกะเพราไก่ไข่ดาว">
        </label>
        <label class="is-wide">
          <span>มื้ออาหาร</span>
          <select name="mealType">
            ${mealTypeOptions(value.mealType)}
          </select>
        </label>
        ${nutritionInput("calories", "Calories", "kcal", value.final.calories, true)}
        ${nutritionInput("protein", "Protein", "g", value.final.protein)}
        ${nutritionInput("carbs", "Carbs", "g", value.final.carbs)}
        ${nutritionInput("fat", "Fat", "g", value.final.fat)}
        <div id="meal-form-error" class="clob-nutrition-error is-wide" hidden></div>
        <button id="save-meal-button" class="clob-nutrition-save is-wide" type="submit">
          <span>${isEditing ? "บันทึกการแก้ไข" : "ยืนยันและบันทึกอาหาร"}</span>
          <span aria-hidden="true">✓</span>
        </button>
        ${isEditing ? `<button id="delete-meal-button" class="clob-meal-delete is-wide" type="button">ลบรายการอาหารนี้</button>` : ""}
      </form>
    </section>
  `);

  const form = document.querySelector("#nutrition-meal-form");
  form.addEventListener("submit", submitMealForm);
  document.querySelector("#delete-meal-button")?.addEventListener("click", deleteEditingMeal);
  setTimeout(() => form.elements.namedItem("name")?.focus(), 80);
}

function aiResultNote(estimate, isNewAi) {
  if (!estimate) return "";
  const confidence = Math.round(Number(estimate.confidence || 0) * 100);
  return `
    <aside class="clob-ai-result-note">
      <div>
        <span>AI ESTIMATE${estimate.reused ? " · CACHED" : ""}</span>
        <strong>ความมั่นใจ ${confidence}%</strong>
      </div>
      ${estimate.notes ? `<p>${escapeHtml(estimate.notes)}</p>` : ""}
      ${Array.isArray(estimate.questions) && estimate.questions.length ? `
        <ul>${estimate.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul>
      ` : ""}
      ${isNewAi ? "<small>ระบบยังไม่บันทึกจนกว่าคุณจะกดยืนยัน</small>" : ""}
    </aside>
  `;
}

async function submitMealForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const errorBox = form.querySelector("#meal-form-error");
  const button = form.querySelector("#save-meal-button");
  const name = String(data.get("name") || "").trim();
  const caloriesText = String(data.get("calories") || "").trim();

  if (!name) {
    showError(errorBox, "กรุณากรอกชื่ออาหาร");
    form.elements.namedItem("name")?.focus();
    return;
  }
  if (caloriesText === "" || Number(caloriesText) < 0) {
    showError(errorBox, "กรุณากรอก Calories ตั้งแต่ 0 ขึ้นไป");
    form.elements.namedItem("calories")?.focus();
    return;
  }

  button.disabled = true;
  button.querySelector("span").textContent = "กำลังบันทึก...";
  hideError(errorBox);

  const source = editingMeal?.source || (aiEstimate ? "ai" : "manual");
  const estimate = aiEstimate || editingMeal?.ai || null;
  try {
    const saved = await saveMeal(code, day.date, {
      ...(editingMeal || {}),
      name,
      mealType: String(data.get("mealType") || "meal"),
      source,
      ai: source === "ai" && estimate ? {
        calories: estimate.calories,
        protein: estimate.protein,
        carbs: estimate.carbs,
        fat: estimate.fat,
        confidence: estimate.confidence,
        model: estimate.model,
        notes: estimate.notes,
        estimatedAt: estimate.estimatedAt
      } : editingMeal?.ai || null,
      imageFingerprint: source === "ai"
        ? aiEstimate?.fingerprint || editingMeal?.imageFingerprint || ""
        : editingMeal?.imageFingerprint || "",
      final: {
        calories: Number(data.get("calories") || 0),
        protein: Number(data.get("protein") || 0),
        carbs: Number(data.get("carbs") || 0),
        fat: Number(data.get("fat") || 0)
      }
    });

    day = await loadNutritionDay(code, day.date);
    recentFoods = await loadRecentFoods(code);
    closeSheet();
    clearPreparedPhoto();
    aiEstimate = null;
    editingMeal = null;
    render();
    toast(saved.savedRemotely ? "บันทึกอาหารแล้ว" : "บันทึกไว้ในเครื่องแล้ว รอเชื่อม Firebase");
  } catch (error) {
    button.disabled = false;
    button.querySelector("span").textContent = "ลองบันทึกอีกครั้ง";
    showError(errorBox, error.message || "บันทึกอาหารไม่สำเร็จ");
  }
}

async function deleteEditingMeal() {
  if (!editingMeal || !window.confirm(`ลบ “${editingMeal.name}” ใช่หรือไม่?`)) return;
  const button = document.querySelector("#delete-meal-button");
  button.disabled = true;
  button.textContent = "กำลังลบ...";
  const deleted = await removeMeal(code, day.date, editingMeal);
  day = await loadNutritionDay(code, day.date);
  closeSheet();
  aiEstimate = null;
  editingMeal = null;
  render();
  toast(deleted.savedRemotely ? "ลบรายการแล้ว" : "ลบจากเครื่องแล้ว รอเชื่อม Firebase");
}

function openSheet(content) {
  const sheet = document.querySelector("#nutrition-sheet");
  sheet.hidden = false;
  sheet.innerHTML = content;
  document.body.classList.add("clob-sheet-open");
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) closeSheet();
  });
  sheet.querySelector("[data-close-nutrition-sheet]")?.addEventListener("click", closeSheet);
}

function closeSheet() {
  const sheet = document.querySelector("#nutrition-sheet");
  if (sheet) sheet.hidden = true;
  document.body.classList.remove("clob-sheet-open");
}

function sheetHeader(kicker, title, description) {
  return `
    <div class="clob-sheet-handle" aria-hidden="true"></div>
    <header class="clob-sheet-header">
      <div>
        <p class="clob-kicker">${escapeHtml(kicker)}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      <button data-close-nutrition-sheet aria-label="ปิด">×</button>
    </header>
  `;
}

function nutritionInput(name, label, unit, value, required = false) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <div class="clob-nutrition-input">
        <input
          name="${escapeHtml(name)}"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.1"
          value="${escapeHtml(value ?? "")}"
          ${required ? "required" : ""}
        >
        <small>${escapeHtml(unit)}</small>
      </div>
    </label>
  `;
}

function mealTypeOptions(selected) {
  return [
    ["breakfast", "มื้อเช้า"],
    ["lunch", "มื้อกลางวัน"],
    ["dinner", "มื้อเย็น"],
    ["snack", "ของว่าง"]
  ].map(([value, label]) => `
    <option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>
  `).join("");
}

function suggestedMealType(date = new Date()) {
  const hour = date.getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

function memberBottomNavMarkup() {
  return `
    <nav class="bottom-nav clob-member-bottom-nav" aria-label="เมนูสมาชิก">
      <button class="nav-item" data-member-nav="home"><span>⌂</span><small>Home</small></button>
      <button class="nav-item" data-member-nav="workout"><span>✦</span><small>Workout</small></button>
      <button class="nav-item is-active" data-member-nav="nutrition" aria-current="page"><span>◒</span><small>Nutrition</small></button>
      <button class="nav-item" data-member-nav="progress"><span>↗</span><small>Progress</small></button>
      <button class="nav-item" data-member-nav="profile"><span>○</span><small>Profile</small></button>
    </nav>
  `;
}

function bindMemberNavigation() {
  document.querySelectorAll("[data-member-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      clearPreparedPhoto();
      const target = button.dataset.memberNav;
      if (target === "home") navigate("/member");
      if (target === "workout") navigate("/workout");
      if (target === "nutrition") navigate("/nutrition");
      if (target === "progress") navigate(`/member-progress-${code}`);
      if (target === "profile") navigate("/member-profile");
    });
  });
}

function loadingMarkup() {
  return `
    <main class="page member-page clob-nutrition-page">
      <section class="member-loading">
        <div class="loading-spinner"></div>
        <p>กำลังโหลด Nutrition...</p>
      </section>
    </main>
  `;
}

function toast(message) {
  const element = document.querySelector("#nutrition-toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  setTimeout(() => { element.hidden = true; }, 2200);
}

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
}

function hideError(element) {
  if (element) element.hidden = true;
}

function clearPreparedPhoto() {
  if (preparedPhoto?.previewUrl) URL.revokeObjectURL(preparedPhoto.previewUrl);
  preparedPhoto = null;
}

function mealTypeShort(type) {
  return { breakfast: "AM", lunch: "NOON", dinner: "PM", snack: "SNACK" }[type] || "MEAL";
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    maximumFractionDigits: number % 1 ? 1 : 0
  });
}

function caloriePercent(consumed, target) {
  return Math.min(100, Math.max(0, Math.round((Number(consumed || 0) / Math.max(1, Number(target || 0))) * 100)));
}

function formatDate(value) {
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

function recentDateKey(days) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return dateKey(value);
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

import { APP_CONFIG } from "./config.js";
import {
  getNutritionTargets,
  saveNutritionTarget as saveNutritionTargetRemote,
  getNutritionMeals,
  saveNutritionMeal as saveNutritionMealRemote,
  getPersonalFoodLibrary,
  savePersonalFood,
  getNutritionFeedback,
  saveNutritionFeedback,
  getAiFoodCache,
  saveAiFoodCache,
  getAiFoodUsage,
  reserveAiFoodUsage,
  releaseAiFoodUsage
} from "./firebase.js";

const TARGETS_PREFIX = "clob_nutrition_targets_";
const MEALS_PREFIX = "clob_nutrition_meals_";
const FOODS_PREFIX = "clob_personal_foods_";
const AI_CACHE_PREFIX = "clob_ai_food_cache_";
const FEEDBACK_PREFIX = "clob_nutrition_feedback_";

export function dateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createMealId(date = dateKey()) {
  return `meal-${String(date).replaceAll("-", "")}-${Date.now().toString(36)}`;
}

export function createTargetId(effectiveFrom = dateKey()) {
  return `target-${String(effectiveFrom).replaceAll("-", "")}-${Date.now().toString(36)}`;
}

export function normalizeNutritionValue(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 10) / 10 : 0;
}

export function normalizeTarget(target = {}, id = "") {
  return {
    id: target.id || id,
    calories: normalizeNutritionValue(target.calories),
    protein: normalizeNutritionValue(target.protein),
    carbs: target.carbs === null || target.carbs === undefined
      ? null
      : normalizeNutritionValue(target.carbs),
    fat: target.fat === null || target.fat === undefined
      ? null
      : normalizeNutritionValue(target.fat),
    effectiveFrom: target.effectiveFrom || dateKey(),
    effectiveTo: target.effectiveTo || null,
    status: target.status || "active",
    createdAt: Number(target.createdAt || 0),
    createdBy: target.createdBy || "trainer",
    updatedAt: Number(target.updatedAt || 0)
  };
}

export function normalizeMeal(meal = {}, id = "") {
  const final = meal.final || meal.nutrition || {};
  const ai = meal.ai && typeof meal.ai === "object"
    ? {
        calories: normalizeNutritionValue(meal.ai.calories),
        protein: normalizeNutritionValue(meal.ai.protein),
        carbs: normalizeNutritionValue(meal.ai.carbs),
        fat: normalizeNutritionValue(meal.ai.fat),
        confidence: Math.max(0, Math.min(1, Number(meal.ai.confidence || 0))),
        model: meal.ai.model || "",
        notes: meal.ai.notes || "",
        estimatedAt: Number(meal.ai.estimatedAt || 0)
      }
    : null;

  return {
    id: meal.id || id,
    memberCode: meal.memberCode || "",
    date: meal.date || dateKey(),
    name: String(meal.name || "").trim(),
    mealType: ["breakfast", "lunch", "dinner", "snack"].includes(meal.mealType)
      ? meal.mealType
      : "meal",
    source: meal.source === "ai" ? "ai" : meal.source === "recent" ? "recent" : "manual",
    ai,
    final: {
      calories: normalizeNutritionValue(final.calories),
      protein: normalizeNutritionValue(final.protein),
      carbs: normalizeNutritionValue(final.carbs),
      fat: normalizeNutritionValue(final.fat)
    },
    imageFingerprint: meal.imageFingerprint || "",
    portion: Number(meal.portion || 1),
    createdAt: Number(meal.createdAt || 0),
    updatedAt: Number(meal.updatedAt || 0),
    createdBy: meal.createdBy || "member",
    updatedBy: meal.updatedBy || meal.createdBy || "member",
    status: meal.status || "active"
  };
}

export function resolveTarget(targets, selectedDate = dateKey()) {
  const chosenTime = new Date(`${selectedDate}T12:00:00`).getTime();
  return Object.entries(targets || {})
    .map(([id, target]) => normalizeTarget(target, id))
    .filter((target) => {
      if (target.status === "deleted") return false;
      const from = new Date(`${target.effectiveFrom}T00:00:00`).getTime();
      const to = target.effectiveTo
        ? new Date(`${target.effectiveTo}T23:59:59`).getTime()
        : Number.POSITIVE_INFINITY;
      return Number.isFinite(from) && from <= chosenTime && chosenTime <= to;
    })
    .sort((a, b) => {
      return b.effectiveFrom.localeCompare(a.effectiveFrom) ||
        Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    })[0] || null;
}

export function calculateNutritionTotals(meals, target = null) {
  const activeMeals = Object.entries(meals || {})
    .map(([id, meal]) => normalizeMeal(meal, id))
    .filter((meal) => meal.status !== "deleted");

  const totals = activeMeals.reduce((sum, meal) => {
    sum.calories += meal.final.calories;
    sum.protein += meal.final.protein;
    sum.carbs += meal.final.carbs;
    sum.fat += meal.final.fat;
    return sum;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  Object.keys(totals).forEach((key) => {
    totals[key] = Math.round(totals[key] * 10) / 10;
  });

  return {
    meals: activeMeals.sort((a, b) => {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    }),
    ...totals,
    remainingCalories: target ? Math.round(target.calories - totals.calories) : null,
    remainingProtein: target ? Math.max(0, Math.round((target.protein - totals.protein) * 10) / 10) : null
  };
}

export async function loadNutritionDay(memberCode, selectedDate = dateKey()) {
  const [remoteTargets, remoteMeals] = await Promise.all([
    getNutritionTargets(memberCode),
    getNutritionMeals(memberCode, selectedDate)
  ]);

  const targets = remoteTargets === null
    ? readLocal(`${TARGETS_PREFIX}${memberCode}`, {})
    : remoteTargets;
  const localMeals = readLocal(mealsKey(memberCode, selectedDate), {});
  const pendingMeals = Object.fromEntries(
    Object.entries(localMeals).filter(([, meal]) => meal?.syncStatus === "pending")
  );
  const meals = remoteMeals === null
    ? localMeals
    : { ...remoteMeals, ...pendingMeals };

  if (remoteTargets !== null) writeLocal(`${TARGETS_PREFIX}${memberCode}`, targets);
  if (remoteMeals !== null) {
    for (const [mealId, meal] of Object.entries(pendingMeals)) {
      const { syncStatus: _syncStatus, ...payload } = meal;
      const synced = await saveNutritionMealRemote(memberCode, selectedDate, mealId, payload);
      if (synced) meals[mealId] = { ...meal, syncStatus: "synced" };
    }
    writeLocal(mealsKey(memberCode, selectedDate), meals);
  }

  const target = resolveTarget(targets, selectedDate);
  const summary = calculateNutritionTotals(meals, target);

  return {
    memberCode,
    date: selectedDate,
    targets,
    target,
    meals: summary.meals,
    summary,
    source: remoteTargets === null || remoteMeals === null ? "local" : "firebase"
  };
}

export async function setNutritionTarget(memberCode, targetInput) {
  const now = Date.now();
  const target = normalizeTarget({
    ...targetInput,
    id: targetInput.id || createTargetId(targetInput.effectiveFrom),
    createdAt: targetInput.createdAt || now,
    updatedAt: now,
    createdBy: "trainer",
    status: "active"
  });

  if (target.calories <= 0) throw new Error("กรุณากำหนด Calories มากกว่า 0");
  if (target.protein < 0) throw new Error("Protein ต้องไม่ติดลบ");

  const saved = await saveNutritionTargetRemote(memberCode, target.id, target);
  if (!saved) {
    throw new Error("บันทึกเป้าหมายไป Firebase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตและ Firebase Rules");
  }

  const local = readLocal(`${TARGETS_PREFIX}${memberCode}`, {});
  local[target.id] = target;
  writeLocal(`${TARGETS_PREFIX}${memberCode}`, local);
  return target;
}

export async function saveMeal(memberCode, selectedDate, mealInput) {
  const now = Date.now();
  const local = readLocal(mealsKey(memberCode, selectedDate), {});
  const existing = mealInput.id ? local[mealInput.id] : null;
  const meal = normalizeMeal({
    ...(existing || {}),
    ...mealInput,
    id: mealInput.id || createMealId(selectedDate),
    memberCode,
    date: selectedDate,
    createdAt: mealInput.createdAt || existing?.createdAt || now,
    updatedAt: now,
    createdBy: mealInput.createdBy || "member",
    status: "active"
  });

  if (!meal.name) throw new Error("กรุณากรอกชื่ออาหาร");
  if (!Number.isFinite(meal.final.calories) || meal.final.calories < 0) {
    throw new Error("Calories ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
  }

  local[meal.id] = { ...meal, syncStatus: "pending" };
  writeLocal(mealsKey(memberCode, selectedDate), local);
  const savedRemotely = await saveNutritionMealRemote(memberCode, selectedDate, meal.id, meal);
  local[meal.id] = {
    ...meal,
    syncStatus: savedRemotely ? "synced" : "pending"
  };
  writeLocal(mealsKey(memberCode, selectedDate), local);

  await updateRecentFood(memberCode, meal, { incrementUsage: !existing });
  return { ...meal, savedRemotely };
}

export async function removeMeal(memberCode, selectedDate, meal) {
  const now = Date.now();
  const local = readLocal(mealsKey(memberCode, selectedDate), {});
  const deleted = normalizeMeal({
    ...meal,
    status: "deleted",
    updatedAt: now
  }, meal.id);
  local[deleted.id] = { ...deleted, syncStatus: "pending" };
  writeLocal(mealsKey(memberCode, selectedDate), local);
  const savedRemotely = await saveNutritionMealRemote(
    memberCode,
    selectedDate,
    deleted.id,
    deleted
  );
  local[deleted.id] = {
    ...deleted,
    syncStatus: savedRemotely ? "synced" : "pending"
  };
  writeLocal(mealsKey(memberCode, selectedDate), local);
  return { ...deleted, savedRemotely };
}

export async function loadRecentFoods(memberCode) {
  const remote = await getPersonalFoodLibrary(memberCode);
  const local = readLocal(`${FOODS_PREFIX}${memberCode}`, {});
  const foods = remote === null ? local : { ...local, ...remote };
  if (remote !== null) writeLocal(`${FOODS_PREFIX}${memberCode}`, foods);
  return Object.entries(foods || {})
    .map(([id, food]) => ({
      id,
      ...food,
      nutrition: {
        calories: normalizeNutritionValue(food.nutrition?.calories),
        protein: normalizeNutritionValue(food.nutrition?.protein),
        carbs: normalizeNutritionValue(food.nutrition?.carbs),
        fat: normalizeNutritionValue(food.nutrition?.fat)
      }
    }))
    .filter((food) => food.status !== "deleted")
    .sort((a, b) => {
      return Number(b.lastUsedAt || 0) - Number(a.lastUsedAt || 0) ||
        Number(b.usageCount || 0) - Number(a.usageCount || 0);
    })
    .slice(0, 20);
}

export async function loadTrainerNutritionFeedback(memberCode, selectedDate = dateKey()) {
  const remote = await getNutritionFeedback(memberCode, selectedDate);
  const key = `${FEEDBACK_PREFIX}${memberCode}_${selectedDate}`;
  const value = remote === null ? readLocal(key, {}) : remote;
  if (remote !== null) writeLocal(key, value);
  return value || {};
}

export async function saveTrainerNutritionFeedback(
  memberCode,
  selectedDate,
  mealId,
  message
) {
  const key = `${FEEDBACK_PREFIX}${memberCode}_${selectedDate}`;
  const local = readLocal(key, {});
  const trimmed = String(message || "").trim();
  const payload = trimmed
    ? {
        mealId,
        type: "comment",
        message: trimmed,
        createdAt: Number(local[mealId]?.createdAt || Date.now()),
        updatedAt: Date.now(),
        createdBy: "trainer"
      }
    : null;

  if (payload) local[mealId] = payload;
  else delete local[mealId];
  writeLocal(key, local);

  const saved = await saveNutritionFeedback(
    memberCode,
    selectedDate,
    mealId,
    payload
  );
  if (!saved) {
    throw new Error("บันทึก Trainer feedback ไป Firebase ไม่สำเร็จ");
  }
  return payload;
}

async function updateRecentFood(memberCode, meal, { incrementUsage = true } = {}) {
  if (meal.status === "deleted") return;
  const local = readLocal(`${FOODS_PREFIX}${memberCode}`, {});
  const foodId = normalizedFoodId(meal.name);
  const existing = local[foodId] || {};
  const food = {
    name: meal.name,
    defaultPortion: meal.portion || 1,
    nutrition: { ...meal.final },
    source: "confirmedMeal",
    usageCount: Number(existing.usageCount || 0) + (incrementUsage ? 1 : 0),
    lastUsedAt: Date.now(),
    createdAt: existing.createdAt || Date.now(),
    status: "active"
  };
  local[foodId] = food;
  writeLocal(`${FOODS_PREFIX}${memberCode}`, local);
  await savePersonalFood(memberCode, foodId, food);
}

export async function getAiQuotaState(memberCode, selectedDate = dateKey()) {
  const usage = await getAiFoodUsage(selectedDate);
  const memberCount = Number(usage?.members?.[memberCode]?.count || 0);
  const total = Number(usage?.total || 0);
  const memberLimit = Number(APP_CONFIG.aiFoodDailyLimitPerMember || 3);
  const projectLimit = Number(APP_CONFIG.aiFoodDailyLimitProject || 60);
  return {
    memberCount,
    total,
    memberLimit,
    projectLimit,
    memberRemaining: Math.max(0, memberLimit - memberCount),
    projectRemaining: Math.max(0, projectLimit - total),
    available: usage !== null && memberCount < memberLimit && total < projectLimit
  };
}

export async function reserveAiAnalysis(memberCode, selectedDate = dateKey()) {
  return reserveAiFoodUsage(memberCode, selectedDate, {
    memberLimit: APP_CONFIG.aiFoodDailyLimitPerMember,
    projectLimit: APP_CONFIG.aiFoodDailyLimitProject
  });
}

export async function releaseAiAnalysis(memberCode, selectedDate = dateKey()) {
  return releaseAiFoodUsage(memberCode, selectedDate);
}

export async function getCachedAiEstimate(memberCode, fingerprint) {
  const local = readLocal(`${AI_CACHE_PREFIX}${memberCode}`, {});
  if (local[fingerprint]) return local[fingerprint];
  const remote = await getAiFoodCache(memberCode, fingerprint);
  if (!remote) return null;
  local[fingerprint] = remote;
  writeLocal(`${AI_CACHE_PREFIX}${memberCode}`, local);
  return remote;
}

export async function cacheAiEstimate(memberCode, fingerprint, estimate) {
  const payload = {
    ...estimate,
    fingerprint,
    cachedAt: Date.now()
  };
  const local = readLocal(`${AI_CACHE_PREFIX}${memberCode}`, {});
  local[fingerprint] = payload;
  writeLocal(`${AI_CACHE_PREFIX}${memberCode}`, local);
  await saveAiFoodCache(memberCode, fingerprint, payload);
  return payload;
}

export function mealTypeLabel(value) {
  return {
    breakfast: "มื้อเช้า",
    lunch: "มื้อกลางวัน",
    dinner: "มื้อเย็น",
    snack: "ของว่าง",
    meal: "มื้ออาหาร"
  }[value] || "มื้ออาหาร";
}

function normalizedFoodId(name) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.#$/[\]\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || `food-${Date.now().toString(36)}`;
}

function mealsKey(memberCode, selectedDate) {
  return `${MEALS_PREFIX}${memberCode}_${selectedDate}`;
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

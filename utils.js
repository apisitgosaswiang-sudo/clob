import {
  getWeeklyCheckins,
  saveWeeklyCheckin,
  deleteWeeklyCheckin,
  getCoachReviews,
  saveCoachReview
} from "./firebase.js";

const CHECKIN_PREFIX = "clob_weekly_checkins_";
const REVIEW_PREFIX = "clob_coach_reviews_";

export function createBlankWeeklyCheckin(memberCode) {
  return {
    id: "",
    memberCode,
    weekStart: getMondayISO(),
    weight: "",
    bodyFat: "",
    sleep: 7,
    stress: 5,
    energy: 5,
    hunger: 5,
    workoutAdherence: 0,
    nutritionAdherence: 0,
    stepsAverage: "",
    cardioMinutes: "",
    wins: "",
    challenges: "",
    coachQuestion: "",
    reviewStatus: "submitted",
    createdAt: 0,
    updatedAt: 0
  };
}

export async function loadWeeklyCheckins(memberCode) {
  const remote = await getWeeklyCheckins(memberCode);
  if (remote) {
    localStorage.setItem(`${CHECKIN_PREFIX}${memberCode}`, JSON.stringify(remote));
    return Object.values(remote).sort(sortNewest);
  }

  return Object.values(loadLocal(CHECKIN_PREFIX, memberCode)).sort(sortNewest);
}

export async function saveWeekly(memberCode, checkin) {
  const now = Date.now();
  const value = {
    ...checkin,
    id: checkin.id || createId(checkin.weekStart),
    memberCode,
    reviewStatus: checkin.reviewStatus || "submitted",
    createdAt: checkin.createdAt || now,
    updatedAt: now
  };

  const local = loadLocal(CHECKIN_PREFIX, memberCode);
  local[value.id] = value;
  localStorage.setItem(`${CHECKIN_PREFIX}${memberCode}`, JSON.stringify(local));
  await saveWeeklyCheckin(memberCode, value.id, value);
  return value;
}

export async function removeWeekly(memberCode, checkinId) {
  const local = loadLocal(CHECKIN_PREFIX, memberCode);
  delete local[checkinId];
  localStorage.setItem(`${CHECKIN_PREFIX}${memberCode}`, JSON.stringify(local));
  await deleteWeeklyCheckin(memberCode, checkinId);
}

export async function loadReviews(memberCode) {
  const remote = await getCoachReviews(memberCode);
  if (remote) {
    localStorage.setItem(`${REVIEW_PREFIX}${memberCode}`, JSON.stringify(remote));
    return remote;
  }
  return loadLocal(REVIEW_PREFIX, memberCode);
}

export async function saveReview(memberCode, checkinId, review) {
  const now = Date.now();
  const value = {
    ...review,
    id: checkinId,
    memberCode,
    status: review.status || "reviewed",
    reviewedAt: review.reviewedAt || now,
    updatedAt: now
  };

  const local = loadLocal(REVIEW_PREFIX, memberCode);
  local[checkinId] = value;
  localStorage.setItem(`${REVIEW_PREFIX}${memberCode}`, JSON.stringify(local));

  await saveCoachReview(memberCode, checkinId, value);
  return value;
}

export function calculateWeeklyScore(checkin) {
  const workout = Number(checkin.workoutAdherence || 0);
  const nutrition = Number(checkin.nutritionAdherence || 0);
  const sleep = Math.min(100, (Number(checkin.sleep || 0) / 8) * 100);
  const energy = Math.min(100, Number(checkin.energy || 0) * 10);
  return Math.round((workout * 0.35) + (nutrition * 0.35) + (sleep * 0.15) + (energy * 0.15));
}

function loadLocal(prefix, memberCode) {
  try {
    return JSON.parse(localStorage.getItem(`${prefix}${memberCode}`) || "{}");
  } catch {
    return {};
  }
}

function createId(weekStart) {
  return `${String(weekStart || "week").replaceAll("-", "")}-${Date.now().toString(36)}`;
}

function sortNewest(a, b) {
  return new Date(b.weekStart || 0) - new Date(a.weekStart || 0) || (b.createdAt || 0) - (a.createdAt || 0);
}

function getMondayISO() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

import { dateKey } from "./nutrition.js";
import {
  getMemberCheckins,
  saveMemberCheckin,
  deleteMemberCheckin
} from "./firebase.js";

const STORAGE_PREFIX = "clob_checkins_";

export function createBlankCheckin(memberCode) {
  return {
    id: "",
    memberCode,
    date: dateKey(),
    weight: "",
    bodyFat: "",
    skeletalMuscle: "",
    chest: "",
    waist: "",
    hip: "",
    arm: "",
    thigh: "",
    note: "",
    photos: {},
    createdAt: 0,
    updatedAt: 0
  };
}

export async function loadCheckins(memberCode) {
  const remote = await getMemberCheckins(memberCode);
  if (remote) {
    saveLocal(memberCode, remote);
    return Object.values(remote).filter(isMetricCheckin).sort(sortNewest);
  }

  const local = loadLocal(memberCode);
  return Object.values(local).filter(isMetricCheckin).sort(sortNewest);
}

export async function saveCheckin(memberCode, checkin) {
  const now = Date.now();
  const local = loadLocal(memberCode);
  const sameDate = Object.values(local).find((item) => {
    return isMetricCheckin(item) && item.date === checkin.date;
  });
  const existing = checkin.id ? local[checkin.id] : sameDate;
  const value = {
    ...(existing || {}),
    ...checkin,
    id: checkin.id || sameDate?.id || createCheckinId(checkin.date),
    memberCode,
    createdAt: checkin.createdAt || existing?.createdAt || now,
    updatedAt: now
  };

  const saved = await saveMemberCheckin(memberCode, value.id, value);
  if (!saved) {
    throw new Error("บันทึก Check-in ไปยัง Firebase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
  }
  local[value.id] = value;
  saveLocal(memberCode, local);
  return value;
}

export async function removeCheckin(memberCode, checkinId) {
  const deleted = await deleteMemberCheckin(memberCode, checkinId);
  if (!deleted) throw new Error("ลบ Check-in จาก Firebase ไม่สำเร็จ");
  const local = loadLocal(memberCode);
  delete local[checkinId];
  saveLocal(memberCode, local);
}

export function calculateChange(checkins, field) {
  const valid = checkins
    .filter((item) => item[field] !== "" && item[field] !== null && item[field] !== undefined)
    .map((item) => Number(item[field]))
    .filter((value) => Number.isFinite(value));

  if (valid.length < 2) return null;
  return Number((valid[0] - valid[valid.length - 1]).toFixed(1));
}

// แนวโน้มช่วง N วันล่าสุด (ค่าล่าสุด - ค่าเก่าสุดภายในช่วง) — คู่กับ calculateChange ที่เทียบจากครั้งแรกสุด
export function calculateRecentChange(checkins, field, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const valid = checkins
    .filter((item) => item[field] !== "" && item[field] !== null && item[field] !== undefined)
    .filter((item) => new Date(item.date || 0).getTime() >= cutoff)
    .map((item) => Number(item[field]))
    .filter((value) => Number.isFinite(value));
  if (valid.length < 2) return null;
  return Number((valid[0] - valid[valid.length - 1]).toFixed(1));
}

export function latestValue(checkins, field) {
  const item = checkins.find((entry) => {
    const value = Number(entry[field]);
    return entry[field] !== "" && Number.isFinite(value);
  });
  return item ? Number(item[field]) : null;
}

export function formatMetric(value, unit) {
  if (value === null || value === "" || value === undefined) return "—";
  return `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)} ${unit}`.trim();
}

export function createCheckinId(date) {
  return `${String(date || "checkin").replaceAll("-", "")}-${Date.now().toString(36)}`;
}

export function isMetricCheckin(item) {
  if (!item || typeof item !== "object") return false;
  return [
    "weight",
    "bodyFat",
    "skeletalMuscle",
    "chest",
    "waist",
    "hip",
    "arm",
    "thigh",
    "note",
    "date"
  ].some((field) => item[field] !== "" && item[field] !== null && item[field] !== undefined);
}

function sortNewest(a, b) {
  const ad = new Date(a.date || 0).getTime();
  const bd = new Date(b.date || 0).getTime();
  return bd - ad || (b.createdAt || 0) - (a.createdAt || 0);
}

function loadLocal(memberCode) {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${memberCode}`) || "{}");
  } catch {
    return {};
  }
}

function saveLocal(memberCode, value) {
  localStorage.setItem(`${STORAGE_PREFIX}${memberCode}`, JSON.stringify(value));
}

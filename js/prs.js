import {
  getMemberPRs,
  saveMemberPR,
  deleteMemberPR
} from "./firebase.js";

const PREFIX = "clob_prs_";

export async function loadPRs(memberCode) {
  const remote = await getMemberPRs(memberCode);
  if (remote) {
    localStorage.setItem(`${PREFIX}${memberCode}`, JSON.stringify(remote));
    return Object.values(remote).sort(sortNewest);
  }

  try {
    return Object.values(
      JSON.parse(localStorage.getItem(`${PREFIX}${memberCode}`) || "{}")
    ).sort(sortNewest);
  } catch {
    return [];
  }
}

export async function savePR(memberCode, pr) {
  const now = Date.now();
  const value = {
    ...pr,
    id: pr.id || `${slug(pr.exercise)}-${now.toString(36)}`,
    memberCode,
    createdAt: pr.createdAt || now,
    updatedAt: now
  };

  const local = loadLocal(memberCode);
  local[value.id] = value;
  localStorage.setItem(`${PREFIX}${memberCode}`, JSON.stringify(local));
  await saveMemberPR(memberCode, value.id, value);
  return value;
}

export async function removePR(memberCode, prId) {
  const local = loadLocal(memberCode);
  delete local[prId];
  localStorage.setItem(`${PREFIX}${memberCode}`, JSON.stringify(local));
  await deleteMemberPR(memberCode, prId);
}

// ตรวจว่าเซตที่เพิ่งบันทึกทำสถิติใหม่ไหม (เทียบน้ำหนักสูงสุดที่เคยยกในท่านั้น)
// ระบบแค่ "แจ้งให้รู้" ไม่ได้ไปแก้โปรแกรมหรือข้อมูลอะไรเอง
export function findNewPR(prs, exerciseName, weight, reps) {
  const value = Number(weight);
  const repCount = Number(reps);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (!Number.isFinite(repCount) || repCount <= 0) return null;

  const key = String(exerciseName || "").trim().toLowerCase();
  if (!key) return null;

  const previous = prs
    .filter((pr) => String(pr.exercise || "").trim().toLowerCase() === key)
    .reduce((best, pr) => Math.max(best, Number(pr.weight || 0)), 0);

  if (value <= previous) return null;
  return { exercise: exerciseName, weight: value, reps: repCount, previous };
}

// บันทึก PR ใหม่อัตโนมัติจากเซตที่ทำจริง
export async function recordAutoPR(memberCode, prs, exerciseName, weight, reps) {
  const found = findNewPR(prs, exerciseName, weight, reps);
  if (!found) return null;
  const saved = await savePR(memberCode, {
    exercise: found.exercise,
    weight: found.weight,
    reps: found.reps,
    date: localDate(),
    source: "auto"
  });
  return { ...found, saved };
}

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function latestPRsByExercise(prs) {
  const best = {};
  for (const pr of prs) {
    const key = pr.exercise.trim().toLowerCase();
    const value = Number(pr.weight || 0);
    if (!best[key] || value > Number(best[key].weight || 0)) best[key] = pr;
  }
  return Object.values(best).sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0));
}

function loadLocal(memberCode) {
  try {
    return JSON.parse(localStorage.getItem(`${PREFIX}${memberCode}`) || "{}");
  } catch {
    return {};
  }
}

function slug(value) {
  return String(value || "exercise")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sortNewest(a, b) {
  return new Date(b.date || 0) - new Date(a.date || 0) || (b.createdAt || 0) - (a.createdAt || 0);
}

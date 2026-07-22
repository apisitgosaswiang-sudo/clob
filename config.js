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

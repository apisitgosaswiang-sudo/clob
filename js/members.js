import { getAllMembers, getWorkoutSessions, saveMemberRecord, memberCodeExists, deleteMemberRecord } from "./firebase.js";

const DEMO_MEMBERS = {};

const LOCAL_MEMBERS_KEY = "clob_hotfix_members_overlay";

function getLocalMembers() {
  try { return JSON.parse(localStorage.getItem(LOCAL_MEMBERS_KEY) || "{}"); }
  catch { return {}; }
}

function saveLocalMember(code, payload) {
  const current = getLocalMembers();
  current[code] = {
    ...(current[code] || {}),
    ...payload,
    package: { ...(current[code]?.package || {}), ...(payload.package || {}) }
  };
  localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(current));
}

export async function loadMembers() {
  const [remoteMembers, remoteSessions] = await Promise.all([getAllMembers(), getWorkoutSessions()]);
  if (remoteMembers !== null) {
    localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(remoteMembers));
    return normalizeMembers(remoteMembers, remoteSessions || {});
  }
  return normalizeMembers(getLocalMembers(), remoteSessions || {});
}

export async function saveMember(member, { isNew = false } = {}) {
  const code = String(member.code || "").replace(/\D/g, "").slice(0, 5);
  if (code.length !== 5) throw new Error("รหัสสมาชิกต้องมี 5 หลัก");
  if (isNew && (getLocalMembers()[code] || await memberCodeExists(code))) throw new Error("รหัสสมาชิกนี้ถูกใช้งานแล้ว");
  const payload = {
    name: member.name || "Member", phone: member.phone || "-", gender: member.gender || "-",
    age: member.age === "" ? "-" : member.age, height: member.height === "" ? "-" : member.height,
    weight: member.weight === "" ? "-" : member.weight, goal: member.goal || "-", status: member.status || "active",
    joinedAt: member.joinedAt || new Date().toISOString().slice(0,10),
    updatedAt: Date.now()
  };
  if (member.package && typeof member.package === "object") {
    payload.package = normalizePackagePayload(member.package);
  }
  const savedRemotely = await saveMemberRecord(code, payload);
  if (!savedRemotely) {
    throw new Error("บันทึก Firebase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตและ Firebase Rules");
  }
  saveLocalMember(code, payload);
  return { code, ...payload };
}

export async function saveMemberPackage(memberCode, packageData) {
  const code = String(memberCode || "").replace(/\D/g, "").slice(0, 5);
  if (code.length !== 5) throw new Error("รหัสสมาชิกต้องมี 5 หลัก");
  const payload = {
    package: normalizePackagePayload(packageData),
    updatedAt: Date.now()
  };
  const savedRemotely = await saveMemberRecord(code, payload);
  if (!savedRemotely) {
    throw new Error("บันทึก Firebase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต, Anonymous Authentication และ Firebase Rules");
  }
  saveLocalMember(code, payload);
  return payload.package;
}

export async function deleteMember(memberCode) {
  const code = String(memberCode || "").replace(/\D/g, "").slice(0, 5);
  if (code.length !== 5) throw new Error("รหัสสมาชิกไม่ถูกต้อง");
  const removed = await deleteMemberRecord(code);
  if (!removed) throw new Error("ลบสมาชิกจาก Firebase ไม่สำเร็จ");
  const local = getLocalMembers();
  delete local[code];
  localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(local));
  [
    `clob_member_program_${code}`,
    `clob_workout_session_${code}`,
    `clob_workout_history_${code}`,
    `clob_weekly_checkins_${code}`,
    `clob_coach_reviews_${code}`,
    `clob_checkins_${code}`
  ].forEach((key) => localStorage.removeItem(key));
  return true;
}

function normalizePackagePayload(packageData = {}) {
  return {
    catalogId: packageData.catalogId || "custom",
    name: packageData.name || "Custom Package",
    startDate: packageData.startDate || "",
    endDate: packageData.endDate || "",
    billingCycle: packageData.billingCycle || "monthly",
    price: Number(packageData.price || 0),
    renewal: packageData.renewal || "manual",
    status: packageData.status || "active",
    features: packageData.features || {
      program: true,
      weeklyCheckin: true,
      habitTracking: true,
      coachReview: true
    }
  };
}

function normalizeMembers(source, sessions) {
  return Object.entries(source || {}).map(([code, member]) => {
    const latestSession = getLatestSession(code, sessions);
    const pkg = member.package || {};

    return {
      code,
      name: member.name || member.greetingName || "Member",
      phone: member.phone || "-",
      gender: member.gender || "-",
      age: member.age || "-",
      height: member.height || "-",
      weight: member.weight || member.weight?.current || "-",
      goal: member.goal || "-",
      status: member.status || "active",
      joinedAt: member.joinedAt || "-",
      packageCatalogId: pkg.catalogId || "custom",
      packageName: pkg.name || "No Package",
      packageStartDate: pkg.startDate || "-",
      packageEndDate: pkg.endDate || "-",
      packageDaysLeft: calculateDaysLeft(pkg.endDate, pkg.daysLeft),
      packagePrice: Number(pkg.price || 0),
      packageBillingCycle: pkg.billingCycle || "monthly",
      packageRenewal: pkg.renewal || "manual",
      packageStatus: pkg.name ? (pkg.status || "active") : "unassigned",
      packageFeatures: pkg.features || {},
      profilePhoto: member.profilePhoto || "",
      profilePhotoPath: member.profilePhotoPath || "",
      profilePhotoUpdatedAt: Number(member.profilePhotoUpdatedAt || 0),
      security: member.security || null,
      workoutStatus: latestSession?.status || member.lastWorkoutStatus || "not_started",
      workoutTitle: latestSession?.title || member.lastWorkoutTitle || "ยังไม่มีโปรแกรม",
      workoutUpdatedAt: latestSession?.updatedAt || member.lastWorkoutUpdatedAt || 0
    };
  });
}

function calculateDaysLeft(endDate, legacyDaysLeft = 0) {
  if (!endDate) return Number(legacyDaysLeft || 0);
  const end = new Date(`${endDate}T23:59:59`);
  return Number.isNaN(end.getTime()) ? Number(legacyDaysLeft || 0) : Math.max(0, Math.ceil((end.getTime()-Date.now())/86400000));
}

function getLatestSession(code, sessions) {
  const memberSessions = sessions?.[code];
  if (!memberSessions) return null;

  return Object.values(memberSessions)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
}

export function getMemberByCode(members, code) {
  return members.find((member) => member.code === code) || null;
}

export function packageStatus(member) {
  if (!member.packageName || member.packageName === "No Package") return "unassigned";
  if (member.packageDaysLeft <= 0) return "expired";
  if (member.packageDaysLeft <= 7) return "expiring";
  return "active";
}

export function sortMembers(members, sortBy = "name") {
  const copy = [...members];

  if (sortBy === "days") {
    return copy.sort((a, b) => a.packageDaysLeft - b.packageDaysLeft);
  }

  if (sortBy === "recent") {
    return copy.sort((a, b) => b.workoutUpdatedAt - a.workoutUpdatedAt);
  }

  return copy.sort((a, b) => a.name.localeCompare(b.name));
}

import { getAllMembers, getWorkoutSessions, saveMemberRecord, memberCodeExists } from "./firebase.js";

const DEMO_MEMBERS = {
  "12345": {
    name: "Apisit",
    phone: "089-123-4567",
    gender: "ชาย",
    age: 29,
    height: 178,
    weight: 78.2,
    goal: "ลดไขมันและเพิ่มกล้ามเนื้อ",
    status: "active",
    joinedAt: "2026-05-01",
    package: {
      name: "Premium 30 Days",
      startDate: "2026-07-05",
      endDate: "2026-08-04",
      daysLeft: 18,
      sessionsLeft: 7,
      totalSessions: 12
    },
    lastWorkoutStatus: "completed",
    lastWorkoutTitle: "Upper Body A",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 38
  },
  "54321": {
    name: "Mina",
    phone: "086-222-4411",
    gender: "หญิง",
    age: 31,
    height: 164,
    weight: 58.4,
    goal: "เพิ่มความแข็งแรง",
    status: "active",
    joinedAt: "2026-05-10",
    package: {
      name: "Premium 30 Days",
      startDate: "2026-07-09",
      endDate: "2026-08-08",
      daysLeft: 5,
      sessionsLeft: 2,
      totalSessions: 12
    },
    lastWorkoutStatus: "in_progress",
    lastWorkoutTitle: "Lower Body B",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 12
  },
  "10001": {
    name: "John",
    phone: "081-888-0101",
    gender: "ชาย",
    age: 34,
    height: 181,
    weight: 84.8,
    goal: "ลดน้ำหนัก",
    status: "active",
    joinedAt: "2026-04-18",
    package: {
      name: "Starter 8 Sessions",
      startDate: "2026-06-20",
      endDate: "2026-07-23",
      daysLeft: 2,
      sessionsLeft: 1,
      totalSessions: 8
    },
    lastWorkoutStatus: "not_started",
    lastWorkoutTitle: "Full Body",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 60 * 7
  },
  "10002": {
    name: "Nan",
    phone: "095-991-8832",
    gender: "หญิง",
    age: 27,
    height: 160,
    weight: 52.1,
    goal: "กระชับสัดส่วน",
    status: "inactive",
    joinedAt: "2026-03-12",
    package: {
      name: "Premium 30 Days",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      daysLeft: 0,
      sessionsLeft: 0,
      totalSessions: 12
    },
    lastWorkoutStatus: "completed",
    lastWorkoutTitle: "Upper Body A",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9
  }
};

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
  const merged = { ...(remoteMembers || DEMO_MEMBERS) };
  Object.entries(getLocalMembers()).forEach(([code, payload]) => {
    merged[code] = { ...(merged[code] || {}), ...payload, package: { ...(merged[code]?.package || {}), ...(payload.package || {}) } };
  });
  return normalizeMembers(merged, remoteSessions);
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
    package: {
      name: member.package?.name || "Online Coaching Monthly", startDate: member.package?.startDate || "", endDate: member.package?.endDate || "",
      billingCycle: "monthly", price: Number(member.package?.price || 0), renewal: member.package?.renewal || "manual",
      status: member.package?.status || "active", features: member.package?.features || { program:true, weeklyCheckin:true, habitTracking:true, coachReview:true }
    }, updatedAt: Date.now()
  };
  saveLocalMember(code,payload); await saveMemberRecord(code,payload); return { code, ...payload };
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
      packageName: pkg.name || "No Package",
      packageStartDate: pkg.startDate || "-",
      packageEndDate: pkg.endDate || "-",
      packageDaysLeft: calculateDaysLeft(pkg.endDate, pkg.daysLeft),
      packagePrice: Number(pkg.price || 0),
      packageBillingCycle: pkg.billingCycle || "monthly",
      packageRenewal: pkg.renewal || "manual",
      packageStatus: pkg.status || "active",
      packageFeatures: pkg.features || {},
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

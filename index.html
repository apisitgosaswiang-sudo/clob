import { getAllMembers, getWorkoutSessions } from "./firebase.js";

const DEMO_MEMBERS = {
  "12345": {
    name: "Apisit",
    package: { daysLeft: 18, sessionsLeft: 7 },
    lastWorkoutStatus: "completed",
    lastWorkoutTitle: "Upper Body A",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 38
  },
  "54321": {
    name: "Mina",
    package: { daysLeft: 5, sessionsLeft: 2 },
    lastWorkoutStatus: "in_progress",
    lastWorkoutTitle: "Lower Body B",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 12
  },
  "10001": {
    name: "John",
    package: { daysLeft: 2, sessionsLeft: 1 },
    lastWorkoutStatus: "not_started",
    lastWorkoutTitle: "Full Body",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 60 * 7
  },
  "10002": {
    name: "Nan",
    package: { daysLeft: 30, sessionsLeft: 10 },
    lastWorkoutStatus: "completed",
    lastWorkoutTitle: "Upper Body A",
    lastWorkoutUpdatedAt: Date.now() - 1000 * 60 * 90
  }
};

export async function loadTrainerDashboard() {
  const remoteMembers = await getAllMembers();
  const remoteSessions = await getWorkoutSessions();

  const members = normalizeMembers(remoteMembers || DEMO_MEMBERS, remoteSessions);

  const summary = {
    total: members.length,
    completed: members.filter((m) => m.status === "completed").length,
    inProgress: members.filter((m) => m.status === "in_progress").length,
    notStarted: members.filter((m) => m.status === "not_started").length,
    needAttention: members.filter((m) => m.needAttention).length,
    expiring: members.filter((m) => m.packageDaysLeft <= 7).length
  };

  const recent = [...members]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);

  return { summary, members, recent };
}

function normalizeMembers(source, sessions) {
  return Object.entries(source || {}).map(([code, member]) => {
    const latestSession = getLatestSessionForMember(code, sessions);
    const status = latestSession?.status || member.lastWorkoutStatus || "not_started";
    const updatedAt = latestSession?.updatedAt || member.lastWorkoutUpdatedAt || 0;
    const title = latestSession?.title || member.lastWorkoutTitle || "ยังไม่มีโปรแกรม";
    const packageDaysLeft = Number(member.package?.daysLeft || 0);
    const sessionsLeft = Number(member.package?.sessionsLeft || 0);

    return {
      code,
      name: member.name || member.greetingName || "Member",
      status,
      updatedAt,
      workoutTitle: title,
      packageDaysLeft,
      sessionsLeft,
      needAttention:
        status === "not_started" ||
        packageDaysLeft <= 3 ||
        sessionsLeft <= 1
    };
  });
}

function getLatestSessionForMember(code, sessions) {
  const memberSessions = sessions?.[code];
  if (!memberSessions) return null;

  return Object.values(memberSessions)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "ยังไม่มีกิจกรรม";

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export function statusLabel(status) {
  return {
    completed: "Completed",
    in_progress: "In Progress",
    not_started: "Not Started"
  }[status] || "Unknown";
}

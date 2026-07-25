import { navigate } from "./router.js";
import { loadMembers } from "./members.js";
import { loadTrainerProfile } from "./trainer-profile.js";
import {
  getDashboardSummary,
  loadOnlineCoachingState,
  markAllNotificationsRead,
  markNotificationRead
} from "./online-coaching.js";
import {
  escapeHtml,
  getGreeting,
  renderAvatar
} from "./utils.js";
import { loadWeeklyCheckins } from "./weekly-checkins.js";
import { loadCheckins } from "./checkins.js";
import { detectMemberAlerts } from "./anomaly-alerts.js";
import { getWorkoutSessions } from "./firebase.js";

const app = document.querySelector("#app");
let members = [];
let notifications = [];
let profile = null;
let checkins = [];
let memberAlerts = [];

export async function renderTrainerDashboardPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  [members, profile] = await Promise.all([loadMembers(), loadTrainerProfile()]);
  checkins = (await Promise.all(members.map((member) => loadWeeklyCheckins(member.code))))
    .flat()
    .map((item) => ({ ...item, memberName: members.find((m) => m.code === item.memberCode)?.name || item.memberCode }));
  const validCodes = new Set(members.map((member) => member.code));
  const stored = loadOnlineCoachingState().notifications.filter((item) => validCodes.has(item.memberCode));
  const submitted = checkins.filter((item) => item.reviewStatus === "submitted").map((item) => ({
    id: `checkin-${item.memberCode}-${item.id}`,
    memberCode: item.memberCode,
    title: `${item.memberName} ส่ง Weekly Check-in`,
    message: `สัปดาห์ ${item.weekStart}`,
    type: "checkin",
    read: false,
    createdAt: item.updatedAt || item.createdAt,
    route: `/weekly-checkins-${item.memberCode}`
  }));
  notifications = [...submitted, ...stored.filter((item) => !submitted.some((entry) => entry.id === item.id))];

  // ตรวจสัญญาณผิดปกติด้วยการคำนวณธรรมดา (ไม่เรียก AI จึงไม่มีค่าใช้จ่าย)
  const activeMembers = members.filter((member) => member.status !== "inactive");
  const [bodyCheckinsPerMember, allSessions] = await Promise.all([
    Promise.all(activeMembers.map((member) => loadCheckins(member.code))),
    getWorkoutSessions()
  ]);
  memberAlerts = activeMembers.flatMap((member, index) => {
    const memberWeekly = checkins.filter((item) => item.memberCode === member.code);
    const memberSessions = Object.values((allSessions || {})[member.code] || {});
    return detectMemberAlerts({
      checkins: bodyCheckinsPerMember[index],
      weeklyCheckins: memberWeekly,
      sessions: memberSessions
    }).map((alert) => ({ ...alert, code: member.code, name: member.name }));
  });

  render();
}

function render() {
  const summary = getDashboardSummary(members, checkins);
  const unreadCount = notifications.filter((item) => !item.read).length;

  app.innerHTML = `
    <main class="page trainer-page">
      <div class="online-dashboard">
        <header class="online-dashboard-header">
          <div>
            <p>${escapeHtml(getGreeting())} 👋</p>
            <h1>Coach ${escapeHtml(profile.name)}</h1>
          </div>

          <button id="trainer-profile-button" class="dashboard-avatar-button" aria-label="Open trainer profile">
            ${renderAvatar({
              name: profile.name,
              photoUrl: profile.profilePhoto,
              className: "dashboard-avatar"
            })}
          </button>
        </header>

        <section class="dashboard-summary-grid">
          ${summaryCard("Check-ins Due", summary.dueToday, "Today")}
          ${summaryCard("Waiting Review", summary.waitingForReview, "Submitted", "waiting-review-card")}
          ${summaryCard("Overdue", summary.overdue, "Needs action")}
          ${summaryCard("Active Clients", summary.activeClients, "Online coaching")}
        </section>

        <section class="dashboard-section-head">
          <div>
            <p class="section-label">PRIORITY</p>
            <h2>Needs Attention</h2>
          </div>
          <button id="view-members">Members</button>
        </section>

        <section class="attention-list">
          ${alertsMarkup()}
          ${attentionMarkup()}
        </section>

        <section class="dashboard-section-head">
          <div>
            <p class="section-label">WORKOUT</p>
            <h2>ภาพรวมการฝึกทุกคน</h2>
          </div>
          <button id="view-workout-overview">ดูทั้งหมด</button>
        </section>

        <section class="dashboard-section-head notification-head">
          <div>
            <p class="section-label">UPDATES</p>
            <h2>Notifications</h2>
          </div>
          <div class="notification-actions">
            <span>${unreadCount}</span>
            <button id="mark-all-read">Mark all</button>
          </div>
        </section>

        <section class="notification-list">
          ${notificationMarkup()}
        </section>

        <nav class="bottom-nav trainer-bottom-nav" aria-label="เมนูเทรนเนอร์">
          <button class="nav-item is-active" data-trainer-route="/trainer"><span>⌂</span><small>Dashboard</small></button>
          <button class="nav-item" data-trainer-route="/members"><span>👥</span><small>Members</small></button>
          <button class="nav-item" data-trainer-route="/programs"><span>▤</span><small>Programs</small></button>
          <button class="nav-item" data-trainer-route="/library"><span>✦</span><small>Library</small></button>
          <button class="nav-item" data-trainer-route="/trainer-settings"><span>⚙</span><small>Settings</small></button>
        </nav>
      </div>
    </main>
  `;

  bind();
}

function summaryCard(label, value, sublabel, id = "") {
  return `
    <article class="dashboard-summary-card card" ${id ? `id="${id}"` : ""}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(sublabel)}</small>
    </article>
  `;
}

// การ์ดเตือนสัญญาณผิดปกติ (คำนวณล้วน ไม่ใช้ AI) — ระบบเสนอ เทรนเนอร์ตัดสินใจ
function alertsMarkup() {
  if (!memberAlerts.length) return "";
  const sorted = [...memberAlerts].sort((a, b) => (a.tone === "danger" ? -1 : 0) - (b.tone === "danger" ? -1 : 0));
  return sorted.slice(0, 3).map((alert) => `
    <button class="attention-card card is-alert ${alert.tone === "danger" ? "is-danger" : ""}" data-member-code="${escapeHtml(alert.code)}">
      ${renderAvatar({ name: alert.name, className: "attention-avatar" })}
      <span class="attention-copy">
        <strong>${escapeHtml(alert.name)}</strong>
        <small>${escapeHtml(alert.message)}</small>
      </span>
      <span class="attention-status ${alert.tone === "danger" ? "danger" : "warning"}"></span>
    </button>
  `).join("");
}

const INACTIVE_DAYS_THRESHOLD = 6;

function attentionMarkup() {
  const now = Date.now();

  // ต้องดูจาก "นานแค่ไหนแล้วที่ไม่มีความเคลื่อนไหว" ไม่ใช่สถานะดิบของ session ล่าสุด
  // ไม่งั้นคนที่หายไปหลายเดือน (แต่ session สุดท้าย completed) จะไม่ถูกแจ้งเตือนเลย
  // และคนที่กำลังออกกำลังกายอยู่ตอนนี้ (in_progress) จะถูกแจ้งเตือนผิดๆ
  const daysSince = (member) => {
    const updated = Number(member.workoutUpdatedAt || 0);
    if (!updated) return null;
    return Math.floor((now - updated) / 86400000);
  };

  const cards = members
    .filter((member) => member.status !== "inactive")
    .map((member) => {
      const idle = daysSince(member);

      if (member.packageDaysLeft <= 0) {
        return { code: member.code, name: member.name, message: "แพ็กเกจหมดอายุแล้ว", tone: "danger", rank: 0 };
      }
      if (member.packageDaysLeft <= 7) {
        return { code: member.code, name: member.name, message: `แพ็กเกจเหลือ ${member.packageDaysLeft} วัน`, tone: "warning", rank: 1 };
      }
      if (idle === null) {
        return { code: member.code, name: member.name, message: "ยังไม่เคยเริ่มโปรแกรม", tone: "warning", rank: 2 };
      }
      if (idle > INACTIVE_DAYS_THRESHOLD) {
        return { code: member.code, name: member.name, message: `ไม่มีการฝึกมา ${idle} วัน`, tone: "warning", rank: 3 };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);

  if (!cards.length) {
    return `<article class="empty-notification card"><strong>ทุกคนอยู่ในเกณฑ์ดี</strong><p>ไม่มีลูกเทรนที่ต้องดูแลเป็นพิเศษตอนนี้</p></article>`;
  }

  return cards.map((item) => `
    <button class="attention-card card" data-member-code="${escapeHtml(item.code)}">
      ${renderAvatar({ name: item.name, className: "attention-avatar" })}
      <span class="attention-copy">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.message)}</small>
      </span>
      <span class="attention-status ${escapeHtml(item.tone)}"></span>
    </button>
  `).join("");
}

function notificationMarkup() {
  if (!notifications.length) {
    return `
      <article class="empty-notification card">
        <strong>You're all caught up</strong>
        <p>No coaching notifications.</p>
      </article>
    `;
  }

  return notifications
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .map((item) => `
      <button class="notification-card card ${item.read ? "" : "is-unread"}"
        data-notification-id="${escapeHtml(item.id)}"
        data-member-code="${escapeHtml(item.memberCode || "")}">
        <span class="notification-dot"></span>
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.message)}</small>
        </span>
        <time>${formatRelativeTime(item.createdAt)}</time>
      </button>
    `).join("");
}

function bind() {
  document.querySelectorAll("[data-trainer-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.trainerRoute));
  });

  document.querySelector("#trainer-profile-button").addEventListener("click", () => {
    navigate("/trainer-settings");
  });

  document.querySelector("#waiting-review-card")?.addEventListener("click", () => {
    const firstCheckin = checkins.find((item) => item.reviewStatus === "submitted");
    if (firstCheckin) navigate(`/weekly-checkins-${firstCheckin.memberCode}`);
  });

  document.querySelector("#view-members").addEventListener("click", () => {
    navigate("/members");
  });

  document.querySelector("#view-workout-overview").addEventListener("click", () => {
    navigate("/workout-overview");
  });

  document.querySelectorAll("[data-member-code]").forEach((button) => {
    button.addEventListener("click", () => {
      const code = button.dataset.memberCode;
      if (code) navigate(`/member-detail-${code}`);
    });
  });

  document.querySelector("#mark-all-read").addEventListener("click", () => {
    notifications = markAllNotificationsRead().notifications;
    render();
  });

  document.querySelectorAll("[data-notification-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.notificationId;
      if (!id.startsWith("checkin-")) notifications = markNotificationRead(id).notifications;
      const code = button.dataset.memberCode;
      if (code) {
        navigate(id.startsWith("checkin-") ? `/weekly-checkins-${code}` : `/member-detail-${code}`);
      } else {
        render();
      }
    });
  });
}

function formatRelativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

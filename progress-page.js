import { navigate } from "./router.js";
import { loadMembers } from "./members.js";
import { getTrainerProfile } from "./trainer-profile.js";
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

const app = document.querySelector("#app");
let members = [];
let notifications = [];
let profile = null;

export async function renderTrainerDashboardPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  members = await loadMembers();
  profile = getTrainerProfile();
  notifications = loadOnlineCoachingState().notifications;
  render();
}

function render() {
  const summary = getDashboardSummary(members, []);
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
          ${attentionMarkup()}
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

function attentionMarkup() {
  const cards = [
    {
      code: members[0]?.code || "10001",
      name: members[0]?.name || "Mint",
      message: "Check-in overdue by 2 days",
      tone: "danger"
    },
    {
      code: members[1]?.code || "10002",
      name: members[1]?.name || "Bank",
      message: "Weekly check-in waiting for review",
      tone: "warning"
    },
    {
      code: members[2]?.code || "10003",
      name: members[2]?.name || "Jane",
      message: "Workout adherence is below target",
      tone: "neutral"
    }
  ];

  return cards.map((item) => `
    <button class="attention-card card" data-member-code="${escapeHtml(item.code)}">
      ${renderAvatar({
        name: item.name,
        className: "attention-avatar"
      })}
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
  document.querySelector("#trainer-profile-button").addEventListener("click", () => {
    navigate("/trainer-settings");
  });

  document.querySelector("#waiting-review-card")?.addEventListener("click", () => {
    const firstMember = members[0];
    if (firstMember) navigate(`/weekly-checkins-${firstMember.code}`);
  });

  document.querySelector("#view-members").addEventListener("click", () => {
    navigate("/members");
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
      notifications = markNotificationRead(id).notifications;
      const code = button.dataset.memberCode;
      if (code) {
        navigate(`/member-detail-${code}`);
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

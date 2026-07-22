import { navigate } from "./router.js";
import {
  loadTrainerDashboard,
  formatRelativeTime,
  statusLabel
} from "./trainer.js";

const app = document.querySelector("#app");

function page(content, extraClass = "") {
  app.innerHTML = `<main class="page ${extraClass}">${content}</main>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export async function renderTrainerDashboard() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  page(`
    <section class="trainer-loading">
      <div class="brand">
        <span class="brand-mark">C</span>
        <span>CLOB</span>
      </div>
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </section>
  `);

  const { summary, members, recent } = await loadTrainerDashboard();

  page(`
    <div class="trainer-screen">
      <header class="trainer-header">
        <div>
          <p>${greeting()} 👋</p>
          <h1>Coach First</h1>
        </div>
        <button id="trainer-avatar" class="avatar-button" aria-label="เมนูเทรนเนอร์">A</button>
      </header>

      <section class="trainer-hero">
        <div>
          <p class="card-kicker">TODAY</p>
          <h2>${summary.total} Members</h2>
          <span>ภาพรวมการฝึกวันนี้</span>
        </div>
        <div class="hero-ring">
          <strong>${summary.completed}</strong>
          <small>Done</small>
        </div>
      </section>

      <section class="trainer-summary-grid">
        <article class="trainer-stat card">
          <span class="trainer-stat-icon success">✓</span>
          <p>Completed</p>
          <strong>${summary.completed}</strong>
        </article>
        <article class="trainer-stat card">
          <span class="trainer-stat-icon progress">↻</span>
          <p>In Progress</p>
          <strong>${summary.inProgress}</strong>
        </article>
        <article class="trainer-stat card">
          <span class="trainer-stat-icon muted">○</span>
          <p>Not Started</p>
          <strong>${summary.notStarted}</strong>
        </article>
        <article class="trainer-stat card">
          <span class="trainer-stat-icon warning">!</span>
          <p>Need Attention</p>
          <strong>${summary.needAttention}</strong>
        </article>
      </section>

      <section class="trainer-alert card">
        <div class="trainer-alert-icon">🎟️</div>
        <div>
          <p>Package Expiring</p>
          <strong>${summary.expiring} Members</strong>
        </div>
        <button id="view-expiring">ดูรายชื่อ</button>
      </section>

      <section class="trainer-section">
        <div class="section-heading">
          <div>
            <p class="section-label">RECENT ACTIVITY</p>
            <h2>กิจกรรมล่าสุด</h2>
          </div>
          <button id="view-all-members" class="button button-text">ดูทั้งหมด</button>
        </div>

        <div class="activity-list">
          ${recent.map((member) => `
            <button class="activity-item card" data-member-code="${member.code}">
              <span class="activity-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</span>
              <span class="activity-copy">
                <strong>${escapeHtml(member.name)}</strong>
                <small>${escapeHtml(member.workoutTitle)}</small>
                <em>${formatRelativeTime(member.updatedAt)}</em>
              </span>
              <span class="status-pill status-${member.status}">
                ${statusLabel(member.status)}
              </span>
            </button>
          `).join("")}
        </div>
      </section>

      <div id="trainer-toast" class="toast" hidden></div>

      <nav class="bottom-nav trainer-bottom-nav" aria-label="เมนูเทรนเนอร์">
        <button class="nav-item is-active" data-trainer-nav="dashboard">
          <span>⌂</span>
          <small>Dashboard</small>
        </button>
        <button class="nav-item" data-trainer-nav="members">
          <span>👥</span>
          <small>Members</small>
        </button>
        <button class="nav-item" data-trainer-nav="programs">
          <span>▤</span>
          <small>Programs</small>
        </button>
        <button class="nav-item" data-trainer-nav="library">
          <span>✦</span>
          <small>Library</small>
        </button>
        <button class="nav-item" data-trainer-nav="settings">
          <span>⚙</span>
          <small>Settings</small>
        </button>
      </nav>
    </div>
  `, "trainer-page");

  const showToast = (message) => {
    const toast = document.querySelector("#trainer-toast");
    toast.textContent = message;
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 2600);
  };

  document.querySelector("#trainer-avatar").addEventListener("click", () => {
    const confirmed = window.confirm("ต้องการออกจากระบบเทรนเนอร์หรือไม่?");
    if (confirmed) {
      sessionStorage.removeItem("clob_trainer");
      navigate("/");
    }
  });

  document.querySelector("#view-expiring").addEventListener("click", () => {
    const names = members
      .filter((member) => member.packageDaysLeft <= 7)
      .map((member) => `${member.name} (${member.packageDaysLeft} วัน)`)
      .join(", ");

    showToast(names || "ไม่มี Package ใกล้หมดอายุ");
  });

  document.querySelector("#view-all-members").addEventListener("click", () => {
    navigate("/members");
  });

  document.querySelectorAll("[data-member-code]").forEach((button) => {
    button.addEventListener("click", () => {
      const member = members.find((item) => item.code === button.dataset.memberCode);
      showToast(`${member.name} · ${statusLabel(member.status)} · เหลือ ${member.sessionsLeft} Sessions`);
    });
  });

  document.querySelectorAll("[data-trainer-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.trainerNav;
      if (target === "dashboard") return;
      if (target === "members") {
        navigate("/members");
        return;
      }

      if (target === "programs") {
        navigate("/programs");
        return;
      }

      if (target === "library") {
        navigate("/library");
        return;
      }

      showToast("Coming soon");
    });
  });
}

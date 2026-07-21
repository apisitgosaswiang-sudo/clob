import { APP_CONFIG } from "./config.js";
import { navigate } from "./router.js";
import { loadMember, createWorkoutSession, getActiveWorkoutSession } from "./member.js";

const app = document.querySelector("#app");

function page(content, extraClass = "") {
  app.innerHTML = `<main class="page ${extraClass}">${content}</main>`;
}

function firebaseStatusMarkup() {
  return `
    <div class="status-row" id="firebase-status">
      <span class="status-dot"></span>
      <span>กำลังเชื่อมต่อ Firebase...</span>
    </div>
  `;
}

function bindFirebaseStatus() {
  const status = document.querySelector("#firebase-status");
  if (!status) return;

  window.addEventListener("clob:firebase-status", (event) => {
    const { ready } = event.detail;
    status.innerHTML = ready
      ? `<span class="status-dot is-online"></span><span>Firebase connected</span>`
      : `<span class="status-dot"></span><span>โหมดออฟไลน์ — หน้าเว็บยังใช้งานได้</span>`;
  }, { once: true });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderLanding() {
  page(`
    <div class="brand">
      <span class="brand-mark">C</span>
      <span>CLOB</span>
    </div>

    <section style="margin-top:34px">
      <p class="eyebrow">Your training starts here</p>
      <h1 class="title">Train smarter.<br>Stay consistent.</h1>
      <p class="subtitle">
        ดูโปรแกรมวันนี้ บันทึกการฝึก และติดตามความก้าวหน้าได้ในที่เดียว
      </p>
    </section>

    <section class="landing-art" aria-label="ภาพรวมการฝึก">
      <div class="landing-art-content">
        <small>TODAY</small>
        <strong>พร้อมเริ่ม Workout วันนี้หรือยัง?</strong>
        <span>โปรแกรมจากโค้ชจะอยู่ตรงนี้</span>
      </div>
    </section>

    <section class="login-card card">
      <label class="field-label" for="member-code">รหัสสมาชิก 5 หลัก</label>
      <input
        id="member-code"
        class="input input-code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="${APP_CONFIG.memberCodeLength}"
        placeholder="•••••"
        aria-describedby="member-helper"
      />
      <button id="member-login-button" class="button button-primary">
        เข้าสู่ระบบสมาชิก
      </button>
      <p id="member-helper" class="helper">
        ทดสอบด้วยรหัส 12345
      </p>
      <div id="member-error" hidden></div>
    </section>

    <div class="trainer-entry">
      <p>สำหรับเทรนเนอร์</p>
      <button id="trainer-entry-button" class="button button-secondary">
        Trainer Login
      </button>
    </div>

    ${firebaseStatusMarkup()}

    <p class="footer-note">${APP_CONFIG.version}</p>
  `, "page-center");

  const input = document.querySelector("#member-code");
  const button = document.querySelector("#member-login-button");
  const errorBox = document.querySelector("#member-error");

  const submit = () => {
    const code = input.value.replace(/\D/g, "");

    if (code.length !== APP_CONFIG.memberCodeLength) {
      errorBox.hidden = false;
      errorBox.className = "alert alert-error";
      errorBox.textContent = "กรุณากรอกรหัสสมาชิกให้ครบ 5 หลัก";
      input.focus();
      return;
    }

    sessionStorage.setItem("clob_member_code", code);
    navigate("/member");
  };

  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, APP_CONFIG.memberCodeLength);
    errorBox.hidden = true;
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });

  button.addEventListener("click", submit);
  document.querySelector("#trainer-entry-button")
    .addEventListener("click", () => navigate("/trainer-login"));

  bindFirebaseStatus();
}

export function renderTrainerLogin() {
  page(`
    <div class="topbar">
      <button id="back-button" class="back-button" aria-label="ย้อนกลับ">←</button>
      <div class="brand">
        <span class="brand-mark">C</span>
        <span>CLOB</span>
      </div>
      <span style="width:42px"></span>
    </div>

    <section style="margin-top:52px">
      <p class="eyebrow">Trainer access</p>
      <h1 class="title" style="font-size:2.5rem">Welcome, Coach.</h1>
      <p class="subtitle">กรอก PIN เพื่อเข้าสู่ Trainer Dashboard</p>
    </section>

    <section class="login-card card">
      <label class="field-label" for="trainer-pin">Trainer PIN</label>
      <input
        id="trainer-pin"
        class="input input-code"
        type="password"
        inputmode="numeric"
        maxlength="4"
        placeholder="••••"
      />
      <button id="trainer-login-button" class="button button-primary">
        เข้าสู่ระบบเทรนเนอร์
      </button>
      <div id="trainer-error" hidden></div>
    </section>
  `);

  const pin = document.querySelector("#trainer-pin");
  const errorBox = document.querySelector("#trainer-error");

  document.querySelector("#back-button").addEventListener("click", () => navigate("/"));

  const submit = () => {
    if (pin.value === APP_CONFIG.trainerPin) {
      sessionStorage.setItem("clob_trainer", "true");
      navigate("/trainer");
      return;
    }

    errorBox.hidden = false;
    errorBox.className = "alert alert-error";
    errorBox.textContent = "PIN ไม่ถูกต้อง กรุณาลองใหม่";
    pin.select();
  };

  pin.addEventListener("input", () => {
    pin.value = pin.value.replace(/\D/g, "").slice(0, 4);
    errorBox.hidden = true;
  });

  pin.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });

  document.querySelector("#trainer-login-button").addEventListener("click", submit);
}

export async function renderMemberDashboard() {
  const code = sessionStorage.getItem("clob_member_code");

  if (!code) {
    navigate("/");
    return;
  }

  page(`
    <section class="member-loading">
      <div class="brand">
        <span class="brand-mark">C</span>
        <span>CLOB</span>
      </div>
      <div class="loading-spinner" aria-label="กำลังโหลด"></div>
      <p>กำลังโหลดข้อมูลสมาชิก...</p>
    </section>
  `);

  const member = await loadMember(code);
  const percentage = Math.min(
    100,
    Math.round((member.week.completed / Math.max(member.week.target, 1)) * 100)
  );

  const weightChangeText = member.weight.change < 0
    ? `ลดลง ${Math.abs(member.weight.change)} ${member.weight.unit}`
    : member.weight.change > 0
      ? `เพิ่มขึ้น ${member.weight.change} ${member.weight.unit}`
      : "ยังไม่มีการเปลี่ยนแปลง";

  page(`
    <div class="member-screen">
      <header class="member-header">
        <div>
          <p class="member-greeting">${getGreeting()} 👋</p>
          <h1>${escapeHtml(member.greetingName)}</h1>
        </div>
        <button id="member-menu-button" class="avatar-button" aria-label="เมนูสมาชิก">
          ${escapeHtml(member.greetingName.charAt(0).toUpperCase())}
        </button>
      </header>

      <section class="today-card">
        <div class="today-card-top">
          <div>
            <p class="card-kicker">TODAY</p>
            <h2>${escapeHtml(member.workout.title)}</h2>
          </div>
          <span class="ready-badge">พร้อมฝึก</span>
        </div>

        <div class="workout-meta">
          <span>⏱ ${member.workout.duration} นาที</span>
          <span>•</span>
          <span>${member.workout.exercises} ท่า</span>
        </div>

        <div class="coach-message">
          <span class="coach-avatar">C</span>
          <div>
            <strong>${escapeHtml(member.coachName)}</strong>
            <p>${escapeHtml(member.coachMessage)}</p>
          </div>
        </div>

        <button id="start-workout-button" class="button button-light">
          เริ่ม Workout
          <span>→</span>
        </button>
      </section>

      <section class="member-section">
        <div class="section-heading">
          <div>
            <p class="section-label">THIS WEEK</p>
            <h2>ความสม่ำเสมอ</h2>
          </div>
          <strong>${member.week.completed} / ${member.week.target}</strong>
        </div>

        <div class="progress-track" aria-label="ความคืบหน้ารายสัปดาห์">
          <div class="progress-fill" style="width:${percentage}%"></div>
        </div>
        <p class="progress-caption">สำเร็จแล้ว ${percentage}% ของเป้าหมายสัปดาห์นี้</p>
      </section>

      <section class="stat-grid">
        <article class="stat-card card">
          <div class="stat-icon">⚖️</div>
          <p>น้ำหนักล่าสุด</p>
          <strong>${member.weight.current || "—"} <small>${member.weight.current ? member.weight.unit : ""}</small></strong>
          <span class="${member.weight.change <= 0 ? "trend-good" : "trend-neutral"}">${weightChangeText}</span>
        </article>

        <article class="stat-card card">
          <div class="stat-icon">🎟️</div>
          <p>Package</p>
          <strong>${member.package.daysLeft} <small>วัน</small></strong>
          <span>เหลือ ${member.package.sessionsLeft} Session</span>
        </article>
      </section>

      <section class="next-session card">
        <div>
          <p class="section-label">${escapeHtml(member.nextSession.label)}</p>
          <h3>${escapeHtml(member.nextSession.date)}</h3>
        </div>
        <strong>${escapeHtml(member.nextSession.time)}</strong>
      </section>

      <div id="member-toast" class="toast" hidden></div>

      <nav class="bottom-nav" aria-label="เมนูสมาชิก">
        <button class="nav-item is-active" data-nav="today">
          <span>⌂</span>
          <small>Today</small>
        </button>
        <button class="nav-item" data-nav="workout">
          <span>✦</span>
          <small>Workout</small>
        </button>
        <button class="nav-item" data-nav="progress">
          <span>↗</span>
          <small>Progress</small>
        </button>
        <button class="nav-item" data-nav="profile">
          <span>○</span>
          <small>Profile</small>
        </button>
      </nav>
    </div>
  `, "member-page");

  document.querySelector("#start-workout-button").addEventListener("click", () => {
    createWorkoutSession(code, member);
    navigate("/workout");
  });

  document.querySelector("#member-menu-button").addEventListener("click", () => {
    const confirmed = window.confirm("ต้องการออกจากระบบสมาชิกหรือไม่?");
    if (confirmed) {
      sessionStorage.removeItem("clob_member_code");
      navigate("/");
    }
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");

      if (button.dataset.nav === "workout") {
        const active = getActiveWorkoutSession(code);
        if (!active || active.status === "completed") {
          createWorkoutSession(code, member);
        }
        navigate("/workout");
        return;
      }

      const labels = {
        progress: "หน้ารายละเอียด Progress จะพร้อมใน Pack 08",
        profile: "หน้า Profile จะเพิ่มใน Pack ถัดไป"
      };

      if (labels[button.dataset.nav]) {
        const toast = document.querySelector("#member-toast");
        toast.hidden = false;
        toast.textContent = labels[button.dataset.nav];
        setTimeout(() => { toast.hidden = true; }, 2600);
      }
    });
  });
}

export function renderTrainerPlaceholder() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  page(`
    <div class="topbar">
      <div class="brand">
        <span class="brand-mark">C</span>
        <span>CLOB</span>
      </div>
      <button id="logout-button" class="button button-text">ออกจากระบบ</button>
    </div>

    <section class="dashboard-placeholder">
      <p class="eyebrow">Trainer mode</p>
      <h1 class="title" style="font-size:2.5rem">Welcome, Coach.</h1>
      <p class="subtitle">Foundation สำหรับ Trainer Dashboard พร้อมใช้งาน</p>

      <div class="preview-card card">
        <p class="preview-label">TRAINER DASHBOARD</p>
        <h2 class="preview-title">Members, Programs & Library</h2>
        <div class="preview-meta">
          <span>Pack 04–07</span>
        </div>
      </div>

      <div class="placeholder-grid">
        <article class="placeholder-card card">
          <h3>Members</h3>
          <p>บริหารสมาชิก ดูสถานะการฝึกและแพ็กเกจ</p>
        </article>
        <article class="placeholder-card card">
          <h3>Programs</h3>
          <p>สร้างและส่งโปรแกรมให้สมาชิก</p>
        </article>
        <article class="placeholder-card card">
          <h3>Exercise Library</h3>
          <p>คลังท่าออกกำลังกายสำหรับสร้างโปรแกรม</p>
        </article>
      </div>
    </section>
  `);

  document.querySelector("#logout-button").addEventListener("click", () => {
    sessionStorage.removeItem("clob_trainer");
    navigate("/");
  });
}

export function renderNotFound() {
  page(`
    <div class="brand">
      <span class="brand-mark">C</span>
      <span>CLOB</span>
    </div>
    <section style="margin-top:52px">
      <p class="eyebrow">404</p>
      <h1 class="title" style="font-size:2.5rem">ไม่พบหน้านี้</h1>
      <button id="home-button" class="button button-primary">กลับหน้าแรก</button>
    </section>
  `, "page-center");

  document.querySelector("#home-button").addEventListener("click", () => navigate("/"));
}

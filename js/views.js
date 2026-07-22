import { APP_CONFIG } from "./config.js";
import { navigate } from "./router.js";
import { loadMember, createWorkoutSession, getActiveWorkoutSession } from "./member.js";
import { getFirebaseStatus } from "./firebase.js";
import { getMemberSecurityState, createMemberPin, verifyMemberPin, formatLockTime } from "./member-security.js";
import { isValidCoachId, verifyCoachPin, formatCoachLockTime } from "./trainer-security.js";

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

  const renderStatus = ({ ready }) => {
    status.innerHTML = ready
      ? `<span class="status-dot is-online"></span><span>Firebase connected</span>`
      : `<span class="status-dot"></span><span>ยังไม่ได้เชื่อมฐานข้อมูล — กรุณาตรวจอินเทอร์เน็ตหรือ Firebase Rules</span>`;
  };

  renderStatus(getFirebaseStatus());
  window.addEventListener("clob:firebase-status", (event) => renderStatus(event.detail), { once: true });
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

  const showError = (message) => {
    errorBox.hidden = false;
    errorBox.className = "alert alert-error";
    errorBox.textContent = message;
  };

  const closePinModal = () => document.querySelector("#member-pin-modal")?.remove();

  const openPinModal = (code, state) => {
    closePinModal();
    const isSetup = !state.hasPin;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="pin-modal-backdrop" id="member-pin-modal" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">
        <section class="pin-modal-card">
          <div class="pin-modal-header">
            <div>
              <p class="section-label">MEMBER SECURITY</p>
              <h2 id="pin-modal-title">${isSetup ? "ตั้ง PIN ใหม่" : "ใส่ PIN"}</h2>
            </div>
            <button id="pin-modal-close" class="pin-close-button" type="button" aria-label="ปิด">×</button>
          </div>
          <p class="pin-modal-help">${isSetup ? "ตั้งรหัสตัวเลข 6 หลักสำหรับเข้าใช้งานครั้งถัดไป" : "กรอก PIN 6 หลักเพื่อยืนยันตัวตน"}</p>
          <label class="field-label" for="member-pin">PIN 6 หลัก</label>
          <input id="member-pin" class="input input-code" type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">
          ${isSetup ? `
            <label class="field-label" for="member-pin-confirm">ยืนยัน PIN อีกครั้ง</label>
            <input id="member-pin-confirm" class="input input-code" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="••••••">
          ` : ""}
          <div id="pin-modal-error" class="alert alert-error" hidden></div>
          <button id="pin-modal-submit" class="button button-primary" type="button">${isSetup ? "ตั้ง PIN และเข้าสู่ระบบ" : "เข้าสู่ระบบ"}</button>
          ${isSetup ? "" : `<button id="forgot-pin" class="button button-text" type="button">ลืม PIN</button>`}
        </section>
      </div>
    `);

    const modal = document.querySelector("#member-pin-modal");
    const pinInput = document.querySelector("#member-pin");
    const confirmInput = document.querySelector("#member-pin-confirm");
    const submitButton = document.querySelector("#pin-modal-submit");
    const modalError = document.querySelector("#pin-modal-error");

    const normalize = (element) => {
      if (!element) return;
      element.value = element.value.replace(/\D/g, "").slice(0, 6);
      modalError.hidden = true;
    };

    pinInput.addEventListener("input", () => normalize(pinInput));
    confirmInput?.addEventListener("input", () => normalize(confirmInput));
    document.querySelector("#pin-modal-close").addEventListener("click", closePinModal);
    modal.addEventListener("click", (event) => { if (event.target === modal) closePinModal(); });
    document.querySelector("#forgot-pin")?.addEventListener("click", () => {
      modalError.hidden = false;
      modalError.textContent = "กรุณาติดต่อ Trainer เพื่อรีเซ็ต PIN";
    });

    const showModalError = (message) => {
      modalError.hidden = false;
      modalError.textContent = message;
    };

    const completeLogin = () => {
      sessionStorage.setItem("clob_member_code", code);
      closePinModal();
      navigate("/member");
    };

    const submitPin = async () => {
      const pin = pinInput.value;
      if (!/^\d{6}$/.test(pin)) {
        showModalError("กรุณากรอก PIN ให้ครบ 6 หลัก");
        pinInput.focus();
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "กำลังตรวจสอบ...";
      try {
        if (isSetup) {
          if (pin !== confirmInput.value) throw new Error("PIN ทั้งสองช่องไม่ตรงกัน");
          await createMemberPin(code, pin);
          completeLogin();
          return;
        }

        const result = await verifyMemberPin(code, pin, state.security);
        if (result.ok) {
          completeLogin();
          return;
        }

        if (result.reason === "locked") {
          showModalError(`ใส่ PIN ผิดหลายครั้ง ระบบถูกล็อกชั่วคราว กรุณาลองใหม่ใน ${formatLockTime(result.lockedUntil)}`);
        } else {
          const remaining = Number.isFinite(result.attemptsRemaining) ? ` เหลือ ${result.attemptsRemaining} ครั้ง` : "";
          showModalError(`PIN ไม่ถูกต้อง${remaining}`);
        }
        pinInput.value = "";
        pinInput.focus();
      } catch (error) {
        showModalError(error.message || "ไม่สามารถตรวจสอบ PIN ได้");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = isSetup ? "ตั้ง PIN และเข้าสู่ระบบ" : "เข้าสู่ระบบ";
      }
    };

    submitButton.addEventListener("click", submitPin);
    [pinInput, confirmInput].filter(Boolean).forEach((element) => {
      element.addEventListener("keydown", (event) => { if (event.key === "Enter") submitPin(); });
    });
    setTimeout(() => pinInput.focus(), 50);
  };

  const submit = async () => {
    const code = input.value.replace(/\D/g, "");

    if (code.length !== APP_CONFIG.memberCodeLength) {
      showError("กรุณากรอกรหัสสมาชิกให้ครบ 5 หลัก");
      input.focus();
      return;
    }

    if (!getFirebaseStatus().ready) {
      showError("ยังไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่");
      return;
    }

    button.disabled = true;
    button.textContent = "กำลังตรวจสอบ...";
    try {
      const state = await getMemberSecurityState(code);
      if (!state.exists) {
        showError("ไม่พบรหัสสมาชิกนี้ กรุณาตรวจสอบอีกครั้ง");
        return;
      }
      if (state.lockedUntil > Date.now()) {
        showError(`บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ใน ${formatLockTime(state.lockedUntil)}`);
        return;
      }
      openPinModal(code, state);
    } catch (error) {
      showError(error.message || "ไม่สามารถตรวจสอบรหัสสมาชิกได้");
    } finally {
      button.disabled = false;
      button.textContent = "เข้าสู่ระบบสมาชิก";
    }
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
      <p class="eyebrow">Coach Portal</p>
      <h1 class="title" style="font-size:2.5rem">Welcome, Coach.</h1>
      <p id="trainer-login-subtitle" class="subtitle">กรอกรหัสเทรนเนอร์เพื่อดำเนินการต่อ</p>
    </section>

    <section class="login-card card">
      <div id="coach-id-step">
        <label class="field-label" for="trainer-id">Coach ID</label>
        <input
          id="trainer-id"
          class="input input-code"
          type="text"
          inputmode="numeric"
          autocomplete="username"
          maxlength="4"
          placeholder="••••"
        />
        <button id="trainer-id-button" class="button button-primary" type="button">
          Continue
        </button>
      </div>

      <div id="coach-pin-step" hidden>
        <div class="coach-login-identity">
          <span>Coach</span>
          <strong>First</strong>
          <button id="change-coach-id" class="button button-text" type="button">เปลี่ยน Coach ID</button>
        </div>
        <label class="field-label" for="trainer-pin">Security PIN 6 หลัก</label>
        <input
          id="trainer-pin"
          class="input input-code"
          type="password"
          inputmode="numeric"
          autocomplete="current-password"
          maxlength="6"
          placeholder="••••••"
        />
        <button id="trainer-login-button" class="button button-primary" type="button">
          Unlock Coach Portal
        </button>
      </div>

      <div id="trainer-error" class="alert alert-error" hidden></div>
    </section>
  `);

  const idStep = document.querySelector("#coach-id-step");
  const pinStep = document.querySelector("#coach-pin-step");
  const coachId = document.querySelector("#trainer-id");
  const pin = document.querySelector("#trainer-pin");
  const errorBox = document.querySelector("#trainer-error");
  const subtitle = document.querySelector("#trainer-login-subtitle");

  const showError = (message) => {
    errorBox.hidden = false;
    errorBox.textContent = message;
  };

  const clearError = () => { errorBox.hidden = true; };

  const openPinStep = () => {
    if (!isValidCoachId(coachId.value)) {
      showError("ไม่พบ Coach ID นี้ กรุณาตรวจสอบอีกครั้ง");
      coachId.select();
      return;
    }
    clearError();
    idStep.hidden = true;
    pinStep.hidden = false;
    subtitle.textContent = "กรอก Security PIN 6 หลักของ Coach First";
    setTimeout(() => pin.focus(), 50);
  };

  const submitPin = async () => {
    const button = document.querySelector("#trainer-login-button");
    if (!/^\d{6}$/.test(pin.value)) {
      showError("กรุณากรอก Security PIN ให้ครบ 6 หลัก");
      pin.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Checking...";
    clearError();

    try {
      const result = await verifyCoachPin(pin.value);
      if (result.ok) {
        sessionStorage.setItem("clob_trainer", "true");
        sessionStorage.setItem("clob_coach_id", coachId.value);
        navigate("/trainer");
        return;
      }

      if (result.reason === "locked") {
        showError(`ใส่ PIN ผิดหลายครั้ง ระบบถูกล็อกชั่วคราว กรุณาลองใหม่ใน ${formatCoachLockTime(result.lockedUntil)}`);
      } else {
        const remaining = Number.isFinite(result.attemptsRemaining)
          ? ` เหลืออีก ${result.attemptsRemaining} ครั้ง`
          : "";
        showError(`Security PIN ไม่ถูกต้อง${remaining}`);
      }
      pin.value = "";
      pin.focus();
    } catch (error) {
      showError(error.message || "ไม่สามารถตรวจสอบ Security PIN ได้");
    } finally {
      button.disabled = false;
      button.textContent = "Unlock Coach Portal";
    }
  };

  document.querySelector("#back-button").addEventListener("click", () => navigate("/"));
  document.querySelector("#trainer-id-button").addEventListener("click", openPinStep);
  document.querySelector("#trainer-login-button").addEventListener("click", submitPin);
  document.querySelector("#change-coach-id").addEventListener("click", () => {
    pinStep.hidden = true;
    idStep.hidden = false;
    subtitle.textContent = "กรอกรหัสเทรนเนอร์เพื่อดำเนินการต่อ";
    pin.value = "";
    clearError();
    coachId.focus();
  });

  coachId.addEventListener("input", () => {
    coachId.value = coachId.value.replace(/\D/g, "").slice(0, 4);
    clearError();
  });
  pin.addEventListener("input", () => {
    pin.value = pin.value.replace(/\D/g, "").slice(0, 6);
    clearError();
  });
  coachId.addEventListener("keydown", (event) => { if (event.key === "Enter") openPinStep(); });
  pin.addEventListener("keydown", (event) => { if (event.key === "Enter") submitPin(); });
  setTimeout(() => coachId.focus(), 50);
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

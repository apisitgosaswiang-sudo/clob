import { navigate } from "./router.js";
import { loadMember, createWorkoutSession, getActiveWorkoutSession } from "./member.js";
import {
  loadTodayState,
  updateHabit,
  toggleTask,
  calculateHabitScore
} from "./member-experience.js";
import { escapeHtml, getGreeting, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");
let member = null;
let state = null;
let code = "";

export async function renderMemberTodayPage() {
  code = sessionStorage.getItem("clob_member_code");
  if (!code) {
    navigate("/");
    return;
  }

  app.innerHTML = `<main class="page member-page"><section class="member-loading"><div class="loading-spinner"></div><p>กำลังโหลด Today...</p></section></main>`;

  [member, state] = await Promise.all([
    loadMember(code),
    loadTodayState(code)
  ]);

  render();
}

function render() {
  const habitScore = calculateHabitScore(state);
  const workoutActive = getActiveWorkoutSession(code);
  const workoutDone = workoutActive?.status === "completed";
  const completedTasks = state.tasks.filter((task) => task.completed).length;

  app.innerHTML = `
    <main class="page member-page">
      <div class="member-screen beta-member-screen">
        <header class="member-header">
          <div>
            <p class="member-greeting">${escapeHtml(getGreeting())} 👋</p>
            <h1>${escapeHtml(member.greetingName)}</h1>
          </div>
          <button id="profile-button" class="avatar-button" aria-label="Profile">
            ${renderAvatar({
              name: member.greetingName,
              photoUrl: member.profilePhoto,
              className: "member-header-avatar"
            })}
          </button>
        </header>

        <section class="beta-release-note">
          <span>PRIVATE BETA</span>
          <p>ข้อมูลการทดลองของคุณจะถูกเก็บแยกจากโครงสร้างเดิม</p>
        </section>

        <section class="today-card beta-workout-card">
          <div class="today-card-top">
            <div>
              <p class="card-kicker">TODAY'S WORKOUT</p>
              <h2>${escapeHtml(member.workout.title)}</h2>
            </div>
            <span class="ready-badge">${workoutDone ? "เสร็จแล้ว" : "พร้อมฝึก"}</span>
          </div>

          <div class="workout-meta">
            <span>⏱ ${Number(member.workout.duration || 0)} นาที</span>
            <span>•</span>
            <span>${Number(member.workout.exercises || 0)} ท่า</span>
          </div>

          <div class="coach-message">
            ${renderAvatar({ name: member.coachName, className: "coach-avatar" })}
            <div>
              <strong>${escapeHtml(member.coachName)}</strong>
              <p>${escapeHtml(member.coachMessage)}</p>
            </div>
          </div>

          <button id="start-workout-button" class="button button-light">
            ${workoutActive?.status === "in_progress" ? "Workout ต่อ" : workoutDone ? "ดู Workout" : "เริ่ม Workout"}
            <span>→</span>
          </button>
        </section>

        <section class="member-section beta-task-section">
          <div class="section-heading">
            <div>
              <p class="section-label">TODAY'S TASKS</p>
              <h2>${completedTasks}/${state.tasks.length} Completed</h2>
            </div>
          </div>
          <div class="member-task-list">
            ${state.tasks.map(taskMarkup).join("")}
          </div>
        </section>

        <section class="member-section">
          <div class="section-heading">
            <div>
              <p class="section-label">DAILY HABITS</p>
              <h2>Consistency</h2>
            </div>
            <strong>${habitScore}%</strong>
          </div>

          <div class="progress-track">
            <div class="progress-fill" style="width:${habitScore}%"></div>
          </div>

          <div class="habit-quick-grid">
            ${state.habits.map(habitMarkup).join("")}
          </div>
        </section>

        <section class="member-quick-links">
          <button id="weekly-link" class="member-quick-card card">
            <span>Weekly Check-in</span><strong>เปิดดู →</strong>
          </button>
          <button id="progress-link" class="member-quick-card card">
            <span>Progress</span><strong>ดูความคืบหน้า →</strong>
          </button>
        </section>

        <div id="member-toast" class="toast" hidden></div>
        ${bottomNav("today")}
      </div>
    </main>
  `;

  bind();
}

function taskMarkup(task) {
  return `
    <label class="member-task-card card">
      <input type="checkbox" data-task-id="${escapeHtml(task.id)}" ${task.completed ? "checked" : ""}>
      <span>
        <strong>${escapeHtml(task.label)}</strong>
        <small>${task.completed ? "Completed" : "Tap when done"}</small>
      </span>
    </label>
  `;
}

function habitMarkup(habit) {
  const percent = Math.min(100, Math.round((Number(habit.value || 0) / Math.max(1, Number(habit.target || 1))) * 100));
  const step = habit.id === "steps" ? 1000 : 1;
  return `
    <article class="habit-quick-card card">
      <div>
        <span>${escapeHtml(habit.label)}</span>
        <strong>${escapeHtml(habit.value)} <small>/ ${escapeHtml(habit.target)} ${escapeHtml(habit.unit)}</small></strong>
      </div>
      <div class="habit-mini-progress"><span style="width:${percent}%"></span></div>
      <div class="habit-adjust">
        <button data-habit-minus="${escapeHtml(habit.id)}" data-step="${step}" aria-label="Decrease">−</button>
        <button data-habit-plus="${escapeHtml(habit.id)}" data-step="${step}" aria-label="Increase">＋</button>
      </div>
    </article>
  `;
}

function bind() {
  document.querySelector("#profile-button").addEventListener("click", () => navigate("/member-profile"));

  document.querySelector("#start-workout-button").addEventListener("click", () => {
    const active = getActiveWorkoutSession(code);
    if (!active || active.status === "completed") createWorkoutSession(code, member);
    navigate("/workout");
  });

  document.querySelector("#weekly-link").addEventListener("click", () => {
    toast("Weekly check-in is reviewed by your coach.");
  });

  document.querySelector("#progress-link").addEventListener("click", () => {
    navigate(`/member-progress-${code}`);
  });

  document.querySelectorAll("[data-task-id]").forEach((input) => {
    input.addEventListener("change", async () => {
      state = await toggleTask(code, input.dataset.taskId, input.checked);
      render();
    });
  });

  document.querySelectorAll("[data-habit-plus], [data-habit-minus]").forEach((button) => {
    button.addEventListener("click", async () => {
      const habitId = button.dataset.habitPlus || button.dataset.habitMinus;
      const habit = state.habits.find((item) => item.id === habitId);
      const step = Number(button.dataset.step || 1);
      const direction = button.dataset.habitPlus ? 1 : -1;
      state = await updateHabit(code, habitId, Number(habit.value || 0) + (step * direction));
      render();
    });
  });

  bindBottomNav();
}

function bottomNav(active) {
  return `
    <nav class="bottom-nav" aria-label="เมนูสมาชิก">
      <button class="nav-item ${active === "today" ? "is-active" : ""}" data-member-nav="today"><span>⌂</span><small>Today</small></button>
      <button class="nav-item ${active === "workout" ? "is-active" : ""}" data-member-nav="workout"><span>✦</span><small>Workout</small></button>
      <button class="nav-item ${active === "progress" ? "is-active" : ""}" data-member-nav="progress"><span>↗</span><small>Progress</small></button>
      <button class="nav-item ${active === "profile" ? "is-active" : ""}" data-member-nav="profile"><span>○</span><small>Profile</small></button>
    </nav>
  `;
}

function bindBottomNav() {
  document.querySelectorAll("[data-member-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.memberNav;
      if (target === "today") navigate("/member");
      if (target === "workout") navigate("/workout");
      if (target === "progress") navigate(`/member-progress-${code}`);
      if (target === "profile") navigate("/member-profile");
    });
  });
}

function toast(message) {
  const element = document.querySelector("#member-toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  setTimeout(() => { element.hidden = true; }, 1600);
}

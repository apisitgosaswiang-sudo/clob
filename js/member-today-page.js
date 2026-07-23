import { navigate } from "./router.js";
import { loadMember, createWorkoutSession, getActiveWorkoutSession } from "./member.js";
import {
  loadTodayState,
  updateHabit,
  toggleTask,
  calculateHabitScore
} from "./member-experience.js";
import {
  formatToday,
  getEmotionMessage,
  missionProgress
} from "./emotion-design.js";
import { escapeHtml, renderAvatar } from "./utils.js";

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

  app.innerHTML = `
    <main class="page member-page clob-v2-today">
      <section class="member-loading">
        <div class="loading-spinner"></div>
        <p>กำลังเตรียม Mission วันนี้...</p>
      </section>
    </main>
  `;

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
  const missions = getMissionTasks(state.tasks, workoutDone);
  const completedMissions = missions.filter((task) => task.completed).length;
  const progress = missionProgress(completedMissions, missions.length);
  const nextMission = missions.find((task) => !task.completed) || null;
  const allComplete = missions.length > 0 && completedMissions === missions.length;
  const emotion = getEmotionMessage({
    completed: completedMissions,
    total: missions.length,
    workoutDone
  });

  app.innerHTML = `
    <main class="page member-page clob-v2-today">
      <div class="member-screen clob-today-shell">
        <header class="clob-today-header">
          <div>
            <span class="clob-wordmark">CLOB</span>
            <p class="clob-today-date">${escapeHtml(formatToday())}</p>
          </div>
          <button id="profile-button" class="avatar-button" aria-label="เปิดโปรไฟล์ของ ${escapeHtml(member.greetingName)}">
            ${renderAvatar({
              name: member.greetingName,
              photoUrl: member.profilePhoto,
              className: "member-header-avatar"
            })}
          </button>
        </header>

        <section class="clob-emotion" data-emotion-tone="${escapeHtml(emotion.tone)}">
          <p class="clob-kicker">${escapeHtml(emotion.eyebrow)} · ${escapeHtml(member.greetingName)}</p>
          <h1>${escapeHtml(emotion.title)}</h1>
          <p>${escapeHtml(emotion.body)}</p>
        </section>

        <section class="clob-mission-hero ${allComplete ? "is-complete" : ""}" aria-labelledby="today-mission-title">
          <div class="clob-mission-head">
            <div>
              <p class="clob-kicker">TODAY'S MISSION</p>
              <h2 id="today-mission-title">${missions.length ? `${completedMissions} of ${missions.length} complete` : "Nothing pending"}</h2>
            </div>
            <div
              class="clob-mission-ring"
              style="--mission-angle:${progress * 3.6}deg"
              role="img"
              aria-label="Mission progress ${progress}%"
            >
              <span class="clob-ring-copy">
                <strong>${progress}%</strong>
                <small>DONE</small>
              </span>
            </div>
          </div>

          <div class="clob-progress-track" aria-hidden="true">
            <span style="--clob-progress-value:${progress}%"></span>
          </div>

          ${missions.length
            ? `<div class="clob-mission-list">
                ${missions.map((task) => missionMarkup(task, task.id === nextMission?.id)).join("")}
              </div>`
            : `<div class="clob-empty-state">
                <strong>No mission today</strong>
                <p>Your coach has not added an action. Recovery is part of the plan.</p>
              </div>`}

          ${missionActionMarkup(nextMission, workoutActive)}

          ${allComplete
            ? `<p class="clob-mission-finish"><span>✓</span> Mission complete. Carry this momentum forward.</p>`
            : ""}
        </section>

        <section class="clob-section" aria-labelledby="workout-brief-title">
          <div class="clob-section-head">
            <div>
              <p class="clob-kicker">TODAY'S PLAN</p>
              <h2 id="workout-brief-title">Workout</h2>
            </div>
            <span class="clob-status ${workoutDone ? "is-success" : ""}">
              ${workoutDone ? "COMPLETE" : workoutActive?.status === "in_progress" ? "IN PROGRESS" : "READY"}
            </span>
          </div>

          <article class="clob-workout-brief">
            <div class="clob-workout-top">
              <div>
                <p class="clob-kicker">${workoutDone ? "COMPLETED SESSION" : "NEXT SESSION"}</p>
                <h3>${escapeHtml(member.workout.title)}</h3>
                <div class="clob-workout-meta">
                  <span>${Number(member.workout.duration || 0)} min</span>
                  <span>·</span>
                  <span>${Number(member.workout.exercises || 0)} exercises</span>
                </div>
              </div>
            </div>

            <div class="clob-coach-note">
              ${renderAvatar({ name: member.coachName, className: "coach-avatar" })}
              <div>
                <strong>${escapeHtml(member.coachName)}</strong>
                <p>${escapeHtml(member.coachMessage)}</p>
              </div>
            </div>

            <button id="start-workout-button" class="clob-tertiary-action">
              <span>${workoutActive?.status === "in_progress" ? "Continue workout" : workoutDone ? "Review workout" : "Open workout"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </article>
        </section>

        <section class="clob-section" aria-labelledby="daily-rhythm-title">
          <div class="clob-section-head">
            <div>
              <p class="clob-kicker">DAILY RHYTHM</p>
              <h2 id="daily-rhythm-title">Consistency</h2>
            </div>
            <strong class="clob-habit-score">${habitScore}%</strong>
          </div>

          <div class="clob-habit-track" aria-label="Daily habit progress ${habitScore}%">
            <span style="--clob-habit-score:${habitScore}%"></span>
          </div>

          <div class="habit-quick-grid">
            ${state.habits.map(habitMarkup).join("")}
          </div>
        </section>

        <section class="clob-quick-links" aria-label="Quick links">
          <button id="weekly-link" class="clob-quick-link">
            <span>COACHING</span>
            <strong>Weekly Check-in →</strong>
          </button>
          <button id="progress-link" class="clob-quick-link">
            <span>YOUR JOURNEY</span>
            <strong>View Progress →</strong>
          </button>
        </section>

        <div id="member-toast" class="toast" role="status" hidden></div>
        ${bottomNav("today")}
      </div>
    </main>
  `;

  bind();
}

function getMissionTasks(tasks, workoutDone) {
  return (Array.isArray(tasks) ? tasks : []).slice(0, 3).map((task) => {
    if (task.id !== "workout" || !workoutDone) return task;
    return {
      ...task,
      completed: true,
      completedFromWorkout: true
    };
  });
}

function missionMarkup(task, isNext) {
  return `
    <label class="clob-mission-item ${task.completed ? "is-complete" : ""} ${isNext ? "is-next" : ""}">
      <span class="clob-mission-check">
        <input
          type="checkbox"
          data-task-id="${escapeHtml(task.id)}"
          ${task.completed ? "checked" : ""}
          ${task.completedFromWorkout ? "disabled" : ""}
        >
        <span aria-hidden="true">✓</span>
      </span>
      <span class="clob-mission-copy">
        <strong>${escapeHtml(task.label)}</strong>
        <small>${task.completed ? "Completed" : isNext ? "Your next action" : "Tap when done"}</small>
      </span>
      ${isNext ? `<span class="clob-next-badge">NEXT</span>` : ""}
    </label>
  `;
}

function missionActionMarkup(task, workoutActive) {
  if (!task) return "";

  if (task.id === "workout") {
    const label = workoutActive?.status === "in_progress" ? "Continue Workout" : "Start Workout";
    return `
      <button id="mission-action" class="clob-primary-action clob-mission-action" data-mission-route="workout">
        ${label}<span aria-hidden="true">→</span>
      </button>
    `;
  }

  if (task.id === "checkin") {
    return `
      <button id="mission-action" class="clob-primary-action clob-mission-action" data-mission-route="weekly">
        Review Weekly Goal<span aria-hidden="true">→</span>
      </button>
    `;
  }

  return `
    <button
      id="mission-action"
      class="clob-primary-action clob-mission-action"
      data-complete-task-id="${escapeHtml(task.id)}"
    >
      Mark Mission Complete<span aria-hidden="true">✓</span>
    </button>
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
        <button data-habit-minus="${escapeHtml(habit.id)}" data-step="${step}" aria-label="ลด ${escapeHtml(habit.label)}">−</button>
        <button data-habit-plus="${escapeHtml(habit.id)}" data-step="${step}" aria-label="เพิ่ม ${escapeHtml(habit.label)}">＋</button>
      </div>
    </article>
  `;
}

function bind() {
  document.querySelector("#profile-button").addEventListener("click", () => navigate("/member-profile"));
  document.querySelector("#start-workout-button").addEventListener("click", openWorkout);

  document.querySelector("#mission-action")?.addEventListener("click", async (event) => {
    const action = event.currentTarget;
    if (action.dataset.missionRoute === "workout") {
      openWorkout();
      return;
    }
    if (action.dataset.missionRoute === "weekly") {
      navigate("/member-weekly");
      return;
    }
    if (action.dataset.completeTaskId) {
      state = await toggleTask(code, action.dataset.completeTaskId, true);
      render();
      toast("Mission complete. Nice work.");
    }
  });

  document.querySelector("#weekly-link").addEventListener("click", () => {
    navigate("/member-weekly");
  });

  document.querySelector("#progress-link").addEventListener("click", () => {
    navigate(`/member-progress-${code}`);
  });

  document.querySelectorAll("[data-task-id]").forEach((input) => {
    input.addEventListener("change", async () => {
      state = await toggleTask(code, input.dataset.taskId, input.checked);
      render();
      toast(input.checked ? "Mission complete. Nice work." : "Mission updated.");
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

function openWorkout() {
  const active = getActiveWorkoutSession(code);
  if (!active || active.status === "completed") createWorkoutSession(code, member);
  navigate("/workout");
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
  setTimeout(() => {
    element.hidden = true;
  }, 1600);
}

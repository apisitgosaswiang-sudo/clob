import { navigate } from "./router.js";
import { loadMember, createWorkoutSession, getActiveWorkoutSession } from "./member.js";
import {
  loadTodayState,
  updateHabit,
  toggleTask
} from "./member-experience.js";
import { loadCheckins, latestValue, calculateChange, formatMetric } from "./checkins.js";
import { chooseHomePriority } from "./dynamic-home.js";
import { formatToday } from "./emotion-design.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");
let member = null;
let state = null;
let checkins = [];
let code = "";

export async function renderMemberTodayPage() {
  code = sessionStorage.getItem("clob_member_code");
  if (!code) {
    navigate("/");
    return;
  }

  app.innerHTML = `
    <main class="page member-page clob-dynamic-home">
      <section class="member-loading">
        <div class="loading-spinner"></div>
        <p>กำลังเตรียม Home วันนี้...</p>
      </section>
    </main>
  `;

  [member, state, checkins] = await Promise.all([
    loadMember(code),
    loadTodayState(code),
    loadCheckins(code)
  ]);

  render();
}

function render() {
  const workoutSession = getActiveWorkoutSession(code);
  const workoutStatus = workoutSession?.status === "completed"
    ? "completed"
    : workoutSession?.status === "in_progress"
      ? "in_progress"
      : "not_started";
  const missions = getMissionTasks(state.tasks, workoutStatus === "completed");
  const priority = chooseHomePriority({
    workoutStatus,
    workoutTitle: member.workout.title,
    missions
  });
  const weight = latestValue(checkins, "weight");
  const weightChange = calculateChange(checkins, "weight");
  const water = state.habits.find((item) => item.id === "water");
  const sleep = state.habits.find((item) => item.id === "sleep");

  app.innerHTML = `
    <main class="page member-page clob-dynamic-home">
      <div class="clob-home-shell">
        <header class="clob-home-header">
          <div>
            <p>${escapeHtml(getGreeting())}</p>
            <h1>${escapeHtml(member.greetingName)}</h1>
            <span>${escapeHtml(formatToday(new Date(), "th-TH"))}</span>
          </div>
          <button id="profile-button" class="avatar-button" aria-label="เปิดโปรไฟล์ของ ${escapeHtml(member.greetingName)}">
            ${renderAvatar({
              name: member.greetingName,
              photoUrl: member.profilePhoto,
              className: "member-header-avatar"
            })}
          </button>
        </header>

        <section class="clob-home-focus" aria-label="สิ่งสำคัญที่สุดตอนนี้">
          ${priorityMarkup(priority, workoutSession)}
        </section>

        <section class="clob-home-section" aria-labelledby="home-today-title">
          <div class="clob-home-section-head">
            <div>
              <p class="clob-kicker">TODAY</p>
              <h2 id="home-today-title">ภาพรวมวันนี้</h2>
            </div>
            <span>${missions.filter((item) => item.completed).length}/${missions.length || 0}</span>
          </div>

          <div class="clob-home-card-stack">
            ${priority.type === "workout" ? "" : workoutCardMarkup(workoutStatus)}
            ${progressCardMarkup(weight, weightChange)}
          </div>
        </section>

        ${(water || sleep) ? `
          <section class="clob-home-section" aria-labelledby="home-rhythm-title">
            <div class="clob-home-section-head">
              <div>
                <p class="clob-kicker">DAILY RHYTHM</p>
                <h2 id="home-rhythm-title">ดูแลร่างกาย</h2>
              </div>
            </div>
            <div class="clob-signal-grid">
              ${water ? signalMarkup(water, 1, "น้ำ") : ""}
              ${sleep ? signalMarkup(sleep, 1, "การนอน") : ""}
            </div>
          </section>
        ` : ""}

        <button id="weekly-link" class="clob-home-coaching-link">
          <span>
            <small>COACHING</small>
            <strong>Weekly Check-in</strong>
          </span>
          <span aria-hidden="true">→</span>
        </button>

        <div id="member-toast" class="toast" role="status" hidden></div>
      </div>
    </main>
  `;

  bind();
}

function priorityMarkup(priority, workoutSession) {
  if (priority.type === "nutrition") {
    const { calorieState } = priority;
    return `
      <article class="clob-priority-card is-nutrition is-${escapeHtml(calorieState.tone)}">
        <div class="clob-priority-top">
          <p class="clob-kicker">🔥 CALORIES</p>
          <span>วันนี้</span>
        </div>
        <div class="clob-calorie-remaining">
          <span>${escapeHtml(calorieState.label)}</span>
          <strong>${calorieState.displayValue.toLocaleString("en-US")}</strong>
          <small>kcal</small>
        </div>
        <button class="clob-priority-action" data-home-route="nutrition">
          เพิ่มอาหาร <span aria-hidden="true">→</span>
        </button>
      </article>
    `;
  }

  if (priority.type === "workout") {
    const isActive = priority.status === "in_progress";
    return `
      <article class="clob-priority-card is-workout">
        <div class="clob-priority-top">
          <p class="clob-kicker">💪 TODAY'S WORKOUT</p>
          <span class="clob-home-status">${isActive ? "IN PROGRESS" : "NOT STARTED"}</span>
        </div>
        <h2>${escapeHtml(member.workout.title)}</h2>
        <div class="clob-priority-meta">
          <span>${Number(member.workout.duration || 0)} นาที</span>
          <span>·</span>
          <span>${Number(member.workout.exercises || 0)} ท่า</span>
        </div>
        <button id="home-primary-action" class="clob-priority-action">
          ${isActive ? "Workout ต่อ" : "เริ่มออกกำลังกาย"}
          <span aria-hidden="true">→</span>
        </button>
        ${member.coachMessage ? `
          <p class="clob-home-coach-note">
            <strong>${escapeHtml(member.coachName)}</strong>
            ${escapeHtml(member.coachMessage)}
          </p>
        ` : ""}
      </article>
    `;
  }

  if (priority.type === "mission") {
    const mission = priority.mission;
    const isWeekly = mission.id === "checkin";
    return `
      <article class="clob-priority-card is-mission">
        <div class="clob-priority-top">
          <p class="clob-kicker">NEXT ACTION</p>
          <span class="clob-home-status">1 STEP LEFT</span>
        </div>
        <h2>${escapeHtml(mission.label)}</h2>
        <p>ทำสิ่งสำคัญต่อไปให้เสร็จ แล้ววันนี้จะครบสมบูรณ์</p>
        <button
          id="home-primary-action"
          class="clob-priority-action"
          ${isWeekly ? `data-mission-route="weekly"` : `data-complete-task-id="${escapeHtml(mission.id)}"`}
        >
          ${isWeekly ? "เปิด Weekly Check-in" : "ทำรายการนี้สำเร็จ"}
          <span aria-hidden="true">→</span>
        </button>
      </article>
    `;
  }

  if (priority.type === "success") {
    return `
      <article class="clob-priority-card is-success">
        <p class="clob-kicker">🎉 PERFECT DAY</p>
        <h2>วันนี้ทำครบแล้ว</h2>
        <p>ทุกสิ่งสำคัญของวันนี้เสร็จเรียบร้อย พักและรักษา Momentum นี้ไว้</p>
        <div class="clob-perfect-mark" aria-hidden="true">✓</div>
      </article>
    `;
  }

  return `
    <article class="clob-priority-card is-recovery">
      <p class="clob-kicker">TODAY</p>
      <h2>Recovery is part of the plan.</h2>
      <p>วันนี้ไม่มีภารกิจค้าง พักให้เต็มที่แล้วกลับมาแข็งแรงกว่าเดิม</p>
    </article>
  `;
}

function workoutCardMarkup(status) {
  return `
    <button class="clob-home-data-card" data-home-route="workout">
      <span class="clob-data-icon">W</span>
      <span class="clob-data-copy">
        <small>WORKOUT</small>
        <strong>${escapeHtml(member.workout.title)}</strong>
        <span>${status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Not started"}</span>
      </span>
      <span class="clob-data-state ${status === "completed" ? "is-done" : ""}">
        ${status === "completed" ? "✓" : "→"}
      </span>
    </button>
  `;
}

function progressCardMarkup(weight, weightChange) {
  const trend = weightChange === null
    ? "ยังไม่มีแนวโน้ม"
    : weightChange === 0
      ? "คงที่จากครั้งแรก"
      : `${weightChange > 0 ? "+" : ""}${weightChange} kg จากครั้งแรก`;

  return `
    <button class="clob-home-data-card" data-home-route="progress">
      <span class="clob-data-icon">↗</span>
      <span class="clob-data-copy">
        <small>WEIGHT</small>
        <strong>${formatMetric(weight, "kg")}</strong>
        <span>${escapeHtml(weight === null ? "แตะเพื่อบันทึก Check-in แรก" : trend)}</span>
      </span>
      <span class="clob-data-state">→</span>
    </button>
  `;
}

function signalMarkup(habit, step, thaiLabel) {
  const value = Number(habit.value || 0);
  const target = Number(habit.target || 0);
  const percent = Math.min(100, Math.round((value / Math.max(1, target)) * 100));

  return `
    <article class="clob-signal-card ${habit.completed ? "is-complete" : ""}">
      <div>
        <small>${escapeHtml(habit.label)}</small>
        <strong>${escapeHtml(habit.value)} <span>/ ${escapeHtml(habit.target)} ${escapeHtml(habit.unit)}</span></strong>
      </div>
      <div class="clob-signal-track" aria-label="${escapeHtml(thaiLabel)} ${percent}%">
        <span style="--signal-progress:${percent}%"></span>
      </div>
      <div class="clob-signal-actions">
        <button data-habit-minus="${escapeHtml(habit.id)}" data-step="${step}" aria-label="ลด${escapeHtml(thaiLabel)}">−</button>
        <button data-habit-plus="${escapeHtml(habit.id)}" data-step="${step}" aria-label="เพิ่ม${escapeHtml(thaiLabel)}">＋</button>
      </div>
    </article>
  `;
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

function bind() {
  document.querySelector("#profile-button").addEventListener("click", () => navigate("/member-profile"));
  document.querySelector("#weekly-link").addEventListener("click", () => navigate("/member-weekly"));

  document.querySelector("#home-primary-action")?.addEventListener("click", async (event) => {
    const action = event.currentTarget;
    if (action.dataset.missionRoute === "weekly") {
      navigate("/member-weekly");
      return;
    }
    if (action.dataset.completeTaskId) {
      state = await toggleTask(code, action.dataset.completeTaskId, true);
      render();
      toast("ทำภารกิจสำเร็จแล้ว");
      return;
    }
    openWorkout();
  });

  document.querySelectorAll("[data-home-route]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.homeRoute === "workout") openWorkout();
      if (button.dataset.homeRoute === "progress") navigate(`/member-progress-${code}`);
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
}

function openWorkout() {
  const active = getActiveWorkoutSession(code);
  if (!active || active.status === "completed") createWorkoutSession(code, member);
  navigate("/workout");
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
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

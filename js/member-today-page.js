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
import { dateKey, loadNutritionDay } from "./nutrition.js";
import { loadReviews } from "./weekly-checkins.js";
import { retryPendingSession, calculateStreakDays, loadMemberWorkoutHistory } from "./member.js";

const app = document.querySelector("#app");
let member = null;
let state = null;
let checkins = [];
let nutritionDay = null;
let unreadReview = null;
let streakDays = 0;
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

  let reviews = {};
  let sessions = [];
  [member, state, checkins, nutritionDay, reviews, sessions] = await Promise.all([
    loadMember(code),
    loadTodayState(code),
    loadCheckins(code),
    loadNutritionDay(code, dateKey()),
    loadReviews(code),
    loadMemberWorkoutHistory(code)
  ]);

  streakDays = calculateStreakDays(sessions);

  unreadReview = findUnreadReview(code, reviews);

  // ถ้ามีข้อมูล workout ที่ค้างซิงค์ไว้ตอนเน็ตหลุด ลองส่งใหม่เงียบๆ
  retryPendingSession(code);

  render();
}

// หารีวิวใหม่จากโค้ชที่ลูกเทรนยังไม่เคยเปิดดู
function findUnreadReview(memberCode, reviews) {
  const list = Object.values(reviews || {}).filter((item) => item && item.status === "reviewed");
  if (!list.length) return null;
  const latest = list.sort((a, b) => Number(b.reviewedAt || 0) - Number(a.reviewedAt || 0))[0];
  const seen = localStorage.getItem(`clob_seen_review_${memberCode}`);
  return String(latest.id) === String(seen) ? null : latest;
}

function render() {
  const workoutSession = getActiveWorkoutSession(code);
  const currentWorkoutSession = workoutSession?.workoutId === member.workout.id ? workoutSession : null;
  // ต้องเช็คจาก alreadyCompletedToday (เทียบวันปฏิทินจาก Firebase) ไม่ใช่จาก session ในเครื่อง
  // ไม่งั้นสถานะ "completed" จะค้างข้ามวัน ทำให้การ์ดชวนออกกำลังกายหายไปถาวร
  const workoutStatus = member.workout.alreadyCompletedToday
    ? "completed"
    : currentWorkoutSession?.status === "in_progress"
      ? "in_progress"
      : "not_started";
  const missions = getMissionTasks(state.tasks, workoutStatus === "completed");
  const priority = chooseHomePriority({
    nutrition: nutritionDay?.target ? {
      targetCalories: nutritionDay.target.calories,
      consumedCalories: nutritionDay.summary.calories,
      dayComplete: false
    } : null,
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
          ${priorityMarkup(priority, currentWorkoutSession)}
        </section>

        ${unreadReview ? `
          <button id="home-review-banner" class="home-review-banner">
            <span class="home-review-dot"></span>
            <span>
              <strong>โค้ชรีวิวรายงานของคุณแล้ว</strong>
              <small>แตะเพื่อดูคำติชมและเป้าหมายสัปดาห์นี้</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ` : ""}

        ${homeWinMarkup(weight, weightChange)}

        <section class="clob-home-section" aria-labelledby="home-today-title">
          <div class="clob-home-section-head">
            <div>
              <p class="clob-kicker">TODAY</p>
              <h2 id="home-today-title">ภาพรวมวันนี้</h2>
            </div>
            <span>${missions.filter((item) => item.completed).length}/${missions.length || 0}</span>
          </div>

          <div class="clob-home-card-stack">
            ${nutritionCardMarkup()}
            ${workoutCardMarkup(workoutStatus)}
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
      ${memberBottomNavMarkup()}
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
        <div class="clob-priority-nutrition-meta">
          <span>ทานแล้ว ${Number(nutritionDay.summary.calories || 0).toLocaleString("en-US")} / ${Number(nutritionDay.target.calories || 0).toLocaleString("en-US")} kcal</span>
          <span>เหลือโปรตีนอีก ${formatMacro(nutritionDay.summary.remainingProtein)} g</span>
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

function homeWinMarkup(weight, weightChange) {
  const hasWeightProgress = weight !== null && weightChange !== null && Number(weightChange) !== 0;
  const hasWorkoutStreak = streakDays >= 2;
  const type = hasWorkoutStreak ? "streak" : "progress";
  const eyebrow = hasWorkoutStreak ? "YOUR WIN · CONSISTENCY" : "YOUR WIN · PROGRESS";
  const hero = hasWorkoutStreak
    ? `${streakDays} DAYS`
    : weightChange === null
      ? (weight === null ? "DAY ONE" : `${formatMetric(weight, "kg")}`)
      : `${weightChange > 0 ? "+" : ""}${weightChange} KG`;
  const copy = hasWorkoutStreak
    ? "You kept showing up. Keep the streak alive."
    : hasWeightProgress
      ? "Quiet work. Visible progress."
      : "Every check-in builds your story.";

  return `
    <section class="mw-home-win" aria-labelledby="mw-home-win-title">
      <div class="mw-home-win-head">
        <div>
          <p class="clob-kicker">${escapeHtml(eyebrow)}</p>
          <h2 id="mw-home-win-title">ความสำเร็จของคุณ</h2>
        </div>
        <button type="button" class="mw-home-win-more" data-home-route="progress">ดูทั้งหมด →</button>
      </div>
      <article class="mw-home-win-card is-${type}">
        <div class="mw-home-win-brand"><span>${hasWorkoutStreak ? "🔥" : "MW"}</span><strong>MORNING WARRIOR</strong></div>
        <div class="mw-home-win-copy">
          <small>${hasWorkoutStreak ? "WORKOUT STREAK" : "MY PROGRESS"}</small>
          <strong>${escapeHtml(hero)}</strong>
          <p>${escapeHtml(copy)}</p>
        </div>
        <div class="mw-home-win-meta">
          <span><b>${escapeHtml(formatMetric(weight, "kg"))}</b> Latest weight</span>
          <span><b>${checkins.length}</b> Check-ins</span>
        </div>
        <button type="button" class="mw-home-share" data-home-share="${type}">
          <span>Share your win</span><span aria-hidden="true">↗</span>
        </button>
      </article>
    </section>
  `;
}

async function shareHomeWin(type) {
  const weight = latestValue(checkins, "weight");
  const change = calculateChange(checkins, "weight");
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, "#101012");
  gradient.addColorStop(.6, "#18181b");
  gradient.addColorStop(1, type === "streak" ? "#2a1608" : "#2a0d15");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = type === "streak" ? "#f97316" : "#e11d48";
  ctx.fillRect(80, 108, 14, 94);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px Arial, sans-serif";
  ctx.fillText("MORNING WARRIOR", 126, 165);
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "700 28px Arial, sans-serif";
  ctx.fillText(type === "streak" ? "WORKOUT STREAK" : "MY PROGRESS", 82, 430);

  const hero = type === "streak"
    ? `${streakDays} DAYS`
    : change === null ? "DAY ONE" : `${change > 0 ? "+" : ""}${change} KG`;
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 142px Arial, sans-serif";
  ctx.fillText(hero, 78, 635);
  ctx.fillStyle = type === "streak" ? "#fdba74" : "#fb7185";
  ctx.font = "700 40px Arial, sans-serif";
  ctx.fillText(type === "streak" ? "KEEP SHOWING UP." : "PROGRESS, NOT PERFECTION.", 82, 720);

  ctx.fillStyle = "rgba(255,255,255,.08)";
  roundHomeRect(ctx, 78, 900, 924, 395, 42);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "600 30px Arial, sans-serif";
  ctx.fillText("LATEST WEIGHT", 130, 1010);
  ctx.fillText("CHECK-INS", 590, 1010);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 66px Arial, sans-serif";
  ctx.fillText(weight === null ? "—" : `${weight} kg`, 130, 1115);
  ctx.fillText(String(checkins.length), 590, 1115);

  ctx.fillStyle = "rgba(255,255,255,.68)";
  ctx.font = "500 34px Arial, sans-serif";
  ctx.fillText("Quiet outside. Active inside.", 82, 1585);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText(member?.greetingName ? String(member.greetingName).toUpperCase() : "MORNING WARRIOR", 82, 1670);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", .96));
  if (!blob) return;
  const file = new File([blob], `morning-warrior-${type}.png`, { type: "image/png" });
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title: "Morning Warrior", text: "Progress, not perfection." });
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("สร้างภาพ Story แล้ว");
}

function roundHomeRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function nutritionCardMarkup() {
  if (!nutritionDay?.target) {
    return `
      <button class="clob-home-data-card" data-home-route="nutrition">
        <span class="clob-data-icon">N</span>
        <span class="clob-data-copy">
          <small>NUTRITION</small>
          <strong>${formatMacro(nutritionDay?.summary?.calories || 0)} kcal</strong>
          <span>เทรนเนอร์ยังไม่ได้ตั้งเป้าหมาย</span>
        </span>
        <span class="clob-data-state">→</span>
      </button>
    `;
  }

  const remaining = Number(nutritionDay.summary.remainingCalories || 0);
  return `
    <button class="clob-home-data-card" data-home-route="nutrition">
      <span class="clob-data-icon">N</span>
      <span class="clob-data-copy">
        <small>NUTRITION</small>
        <strong>${remaining < 0 ? "เกิน" : "เหลือ"} ${Math.abs(Math.round(remaining)).toLocaleString("en-US")} kcal</strong>
        <span>Protein ${formatMacro(nutritionDay.summary.protein)} / ${formatMacro(nutritionDay.target.protein)} g</span>
      </span>
      <span class="clob-data-state">→</span>
    </button>
  `;
}

function workoutCardMarkup(status) {
  return `
    <button class="clob-home-data-card" data-home-route="workout">
      <span class="clob-data-icon">W</span>
      <span class="clob-data-copy">
        <small>WORKOUT${Number(member.workout.queueLength) > 1 ? ` · DAY ${member.workout.dayNumber}/${member.workout.queueLength}` : ""}</small>
        <strong>${escapeHtml(member.workout.title)}</strong>
        <span>${status === "completed" ? "วันนี้ทำสำเร็จแล้ว" : status === "in_progress" ? "กำลังทำอยู่" : "ยังไม่เริ่ม"}</span>
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

  document.querySelector("#home-review-banner")?.addEventListener("click", () => navigate("/member-weekly"));

  document.querySelector("[data-home-share]")?.addEventListener("click", (event) => {
    shareHomeWin(event.currentTarget.dataset.homeShare);
  });

  document.querySelectorAll("[data-home-route]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.homeRoute === "workout") openWorkout();
      if (button.dataset.homeRoute === "nutrition") navigate("/nutrition");
      if (button.dataset.homeRoute === "progress") navigate(`/member-progress-${code}`);
    });
  });

  document.querySelectorAll("[data-member-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.memberNav;
      if (target === "home") navigate("/member");
      if (target === "workout") openWorkout();
      if (target === "nutrition") navigate("/nutrition");
      if (target === "progress") navigate(`/member-progress-${code}`);
      if (target === "profile") navigate("/member-profile");
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
  navigate("/workout");
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function memberBottomNavMarkup() {
  return `
    <nav class="bottom-nav clob-member-bottom-nav" aria-label="เมนูสมาชิก">
      <button class="nav-item is-active" data-member-nav="home" aria-current="page">
        <span>⌂</span>
        <small>Home</small>
      </button>
      <button class="nav-item" data-member-nav="workout">
        <span>✦</span>
        <small>Workout</small>
      </button>
      <button class="nav-item" data-member-nav="nutrition">
        <span>◒</span>
        <small>Nutrition</small>
      </button>
      <button class="nav-item" data-member-nav="progress">
        <span>↗</span>
        <small>Progress</small>
      </button>
      <button class="nav-item" data-member-nav="profile">
        <span>○</span>
        <small>Profile</small>
      </button>
    </nav>
  `;
}

function formatMacro(value) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    maximumFractionDigits: number % 1 ? 1 : 0
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

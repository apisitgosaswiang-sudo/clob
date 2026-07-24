import { APP_CONFIG } from "./config.js";
import { navigate } from "./router.js";
import {
  loadMember,
  createWorkoutSession,
  getActiveWorkoutSession,
  syncSessionWithProgram,
  updateWorkoutSet,
  setCurrentExercise,
  completeWorkout,
  cancelWorkoutSession,
  countCompletedSets,
  countTotalSets,
  getWorkoutProgress
} from "./member.js";

const app = document.querySelector("#app");
let timerInterval = null;

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

function formatDuration(milliseconds) {
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} ชม. ${minutes} นาที` : `${minutes} นาที`;
}

export async function renderWorkoutOverview() {
  const code = sessionStorage.getItem("clob_member_code");
  if (!code) {
    navigate("/");
    return;
  }

  const member = await loadMember(code);
  let session = getActiveWorkoutSession(code);
  if (session && session.status === "in_progress" && session.workoutId !== member.workout.id && countCompletedSets(session) === 0) {
    cancelWorkoutSession(code);
    session = null;
  }

  // เทรนเนอร์อาจเพิ่มท่าใหม่เข้าโปรแกรมนี้ระหว่างที่ยังทำ session ไม่เสร็จ
  // ดึงท่าที่เพิ่มมาใหม่มาต่อท้ายให้ทันที ไม่ต้อง Finish อันเก่าก่อน
  if (session && session.status === "in_progress" && session.workoutId === member.workout.id) {
    session = syncSessionWithProgram(code, member, session);
  }

  const hasActiveSessionForThisWorkout = session && session.status === "in_progress" && session.workoutId === member.workout.id;

  // ทำ workout นี้สำเร็จไปแล้ววันนี้ และไม่มี session ที่กำลังทำต่ออยู่ -> ล็อกไม่ให้เริ่มซ้ำ
  if (!hasActiveSessionForThisWorkout && member.workout.alreadyCompletedToday) {
    page(`
      <div class="workout-screen">
        <header class="workout-topbar">
          <button id="workout-back" class="back-button" aria-label="กลับ">←</button>
          <div><p>WORKOUT</p><h1>${escapeHtml(member.workout.title)}</h1></div>
          <span class="workout-percent">DONE</span>
        </header>
        <section class="workout-progress-card card">
          <div><span>สถานะวันนี้</span><strong>ทำสำเร็จแล้ว ✓</strong></div>
          <small>ทำโปรแกรมนี้ครบแล้วสำหรับวันนี้ กลับมาใหม่พรุ่งนี้ได้เลย</small>
        </section>
        <section class="workout-progress-card card">
          <div><span>โปรแกรมถัดไป</span><strong>${escapeHtml(member.workout.title)}</strong></div>
          <small>ระบบจะเตรียมโปรแกรมนี้ไว้ให้ในรอบถัดไปตามคิวที่เทรนเนอร์จัดไว้</small>
        </section>
        <button id="view-workout-history" class="button button-secondary finish-workout-button">ดูประวัติที่ทำสำเร็จแล้ว</button>
        ${memberWorkoutNav()}
      </div>
    `, "workout-page");
    document.querySelector("#workout-back").onclick = () => navigate("/member");
    document.querySelector("#view-workout-history").onclick = () => navigate("/member-workout-history");
    document.querySelectorAll("[data-member-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.memberRoute)));
    document.querySelector("[data-member-progress]")?.addEventListener("click", () => navigate(`/member-progress-${code}`));
    return;
  }

  if (!session || session.status === "completed") {
    page(`
      <div class="workout-screen">
        <header class="workout-topbar">
          <button id="workout-back" class="back-button" aria-label="กลับ">←</button>
          <div><p>WORKOUT</p><h1>${escapeHtml(member.workout.title)}</h1>${member.workout.dayLabel ? `<small>${escapeHtml(member.workout.dayLabel)}</small>` : ""}</div>
          <span class="workout-percent">READY</span>
        </header>
        <section class="workout-progress-card card">
          <div><span>โปรแกรมวันนี้</span><strong>${Number(member.workout.exercises || 0)} ท่า</strong></div>
          <small>ระบบจะเริ่มจับเวลาเมื่อคุณกดเริ่ม ไม่สร้าง Session จากการเปิดหน้าดูเฉย ๆ</small>
        </section>
        <button id="start-workout-button" class="button button-primary finish-workout-button">เริ่มออกกำลังกาย</button>
        <button id="view-workout-history" class="button button-text finish-workout-button">ดูประวัติที่ทำสำเร็จแล้ว</button>
        ${memberWorkoutNav()}
      </div>
    `, "workout-page");
    document.querySelector("#workout-back").onclick = () => navigate("/member");
    document.querySelector("#start-workout-button").onclick = () => {
      createWorkoutSession(code, member);
      renderWorkoutOverview();
    };
    document.querySelector("#view-workout-history").onclick = () => navigate("/member-workout-history");
    document.querySelectorAll("[data-member-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.memberRoute)));
    document.querySelector("[data-member-progress]")?.addEventListener("click", () => navigate(`/member-progress-${code}`));
    return;
  }

  const progress = getWorkoutProgress(session);
  const completedSets = countCompletedSets(session);
  const totalSets = countTotalSets(session);

  page(`
    <div class="workout-screen">
      <header class="workout-topbar">
        <button id="workout-back" class="back-button" aria-label="กลับ">←</button>
        <div>
          <p>WORKOUT</p>
          <h1>${escapeHtml(session.title)}</h1>
        </div>
        <span class="workout-percent">${progress}%</span>
      </header>

      <section class="workout-progress-card card">
        <div>
          <span>ความคืบหน้า</span>
          <strong>${completedSets} / ${totalSets} Sets</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <small>เริ่มเมื่อ ${new Date(session.startedAt).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit"
        })}</small>
      </section>

      <section class="exercise-list-section">
        <div class="section-heading">
          <div>
            <p class="section-label">EXERCISES</p>
            <h2>รายการฝึกวันนี้</h2>
          </div>
          <strong>${session.exercises.length} ท่า</strong>
        </div>

        <div class="exercise-list">
          ${session.exercises.map((exercise, index) => {
            const completed = exercise.sets.filter((set) => set.completed).length;
            return `
              <button class="exercise-list-item card ${exercise.completed ? "is-complete" : ""}" data-exercise-index="${index}">
                <span class="exercise-order">${exercise.completed ? "✓" : index + 1}</span>
                <span class="exercise-copy">
                  ${exercise.imageUrl ? `<img class="exercise-thumb" src="${escapeHtml(exercise.imageUrl)}" alt="">` : ""}
                  <span class="exercise-copy-text">
                    <strong>${escapeHtml(exercise.name)}</strong>
                    <small>${exercise.targetSets} × ${escapeHtml(exercise.targetReps)} · พัก ${exercise.restSeconds} วินาที</small>
                  </span>
                </span>
                <span class="exercise-set-count">${completed}/${exercise.sets.length}</span>
                <span class="exercise-arrow">›</span>
              </button>
            `;
          }).join("")}
        </div>
      </section>

      <button id="finish-workout-button" class="button ${progress === 100 ? "button-primary" : "button-secondary"} finish-workout-button">
        ${progress === 100 ? "Finish Workout" : "บันทึกและกลับภายหลัง"}
      </button>
      ${completedSets === 0 ? `<button id="cancel-workout-button" class="button button-text finish-workout-button">ยกเลิกการฝึกครั้งนี้</button>` : ""}
      ${memberWorkoutNav()}
    </div>
  `, "workout-page");

  document.querySelector("#workout-back").addEventListener("click", () => navigate("/member"));
  document.querySelectorAll("[data-member-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.memberRoute)));
  document.querySelector("[data-member-progress]")?.addEventListener("click", () => navigate(`/member-progress-${code}`));

  document.querySelectorAll("[data-exercise-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.exerciseIndex);
      setCurrentExercise(code, session, index);
      navigate(`/workout-exercise-${index}`);
    });
  });

  document.querySelector("#finish-workout-button").addEventListener("click", () => {
    if (progress < 100) {
      navigate("/member");
      return;
    }

    completeWorkout(code, session);
    navigate("/workout-complete");
  });
  document.querySelector("#cancel-workout-button")?.addEventListener("click", () => {
    if (!window.confirm("ยกเลิก Session ที่ยังไม่ได้บันทึกเซตใช่หรือไม่?")) return;
    cancelWorkoutSession(code);
    navigate("/member");
  });
}

export async function renderExerciseTracker(exerciseIndex) {
  const code = sessionStorage.getItem("clob_member_code");
  if (!code) {
    navigate("/");
    return;
  }

  const member = await loadMember(code);
  let session = getActiveWorkoutSession(code) || createWorkoutSession(code, member);
  const exercise = session.exercises[exerciseIndex];

  if (!exercise) {
    navigate("/workout");
    return;
  }

  const completedCount = exercise.sets.filter((set) => set.completed).length;

  page(`
    <div class="exercise-tracker-screen">
      <header class="exercise-tracker-header">
        <button id="exercise-back" class="back-button" aria-label="กลับ">←</button>
        <div>
          <p>${escapeHtml(exercise.category)}</p>
          <h1>${escapeHtml(exercise.name)}</h1>
        </div>
        <span>${completedCount}/${exercise.sets.length}</span>
      </header>

      ${exercise.imageUrl ? `<div class="exercise-tracker-image"><img src="${escapeHtml(exercise.imageUrl)}" alt="${escapeHtml(exercise.name)}"></div>` : ""}

      <section class="exercise-instruction card">
        <div>
          <strong>${exercise.targetSets} Sets × ${escapeHtml(exercise.targetReps)}</strong>
          <p>${escapeHtml(exercise.note || "")}</p>
        </div>
        <span>พัก ${exercise.restSeconds} วิ</span>
      </section>

      <section class="set-table">
        <div class="set-table-header">
          <span>SET</span>
          <span>KG</span>
          <span>REPS</span>
          <span>RPE</span>
          <span></span>
        </div>

        ${exercise.sets.map((set, setIndex) => `
          <div class="set-row ${set.completed ? "is-complete" : ""}">
            <strong>${set.setNumber}</strong>
            <input
              class="set-input"
              id="weight-${setIndex}"
              type="number"
              inputmode="decimal"
              min="0"
              step="0.5"
              value="${set.weight}"
              placeholder="0"
              aria-label="น้ำหนักเซต ${set.setNumber}"
            />
            <input
              class="set-input"
              id="reps-${setIndex}"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              value="${set.reps}"
              placeholder="0"
              aria-label="จำนวนครั้งเซต ${set.setNumber}"
            />
            <input
              class="set-input"
              id="rpe-${setIndex}"
              type="number"
              inputmode="decimal"
              min="1"
              max="10"
              step="0.5"
              value="${set.rpe}"
              placeholder="—"
              aria-label="RPE เซต ${set.setNumber}"
            />
            <button class="set-save-button ${set.completed ? "is-complete" : ""}" data-set-index="${setIndex}" aria-label="บันทึกเซต ${set.setNumber}">
              ${set.completed ? "✓" : "บันทึก"}
            </button>
          </div>
        `).join("")}
      </section>

      <div class="exercise-actions">
        <button id="previous-exercise" class="button button-secondary" ${exerciseIndex === 0 ? "disabled" : ""}>
          ← ก่อนหน้า
        </button>
        <button id="next-exercise" class="button button-primary">
          ${exerciseIndex === session.exercises.length - 1 ? "ดูสรุป" : "ท่าถัดไป →"}
        </button>
      </div>

      <div id="workout-toast" class="toast" hidden></div>

      ${memberWorkoutNav()}
      <div id="rest-timer" class="rest-timer" hidden>
        <div class="rest-timer-card">
          <p>REST TIMER</p>
          <strong id="rest-timer-value">${exercise.restSeconds}</strong>
          <span>วินาที</span>
          <button id="skip-rest" class="button button-secondary">ข้ามเวลาพัก</button>
        </div>
      </div>
    </div>
  `, "workout-page");

  document.querySelector("#exercise-back").addEventListener("click", () => navigate("/workout"));
  document.querySelectorAll("[data-member-route]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.memberRoute)));
  document.querySelector("[data-member-progress]")?.addEventListener("click", () => navigate(`/member-progress-${code}`));

  document.querySelectorAll("[data-set-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const setIndex = Number(button.dataset.setIndex);
      const weight = document.querySelector(`#weight-${setIndex}`).value;
      const reps = document.querySelector(`#reps-${setIndex}`).value;
      const rpe = document.querySelector(`#rpe-${setIndex}`).value;

      if (reps === "") {
        showToast("กรุณากรอกจำนวน Reps");
        document.querySelector(`#reps-${setIndex}`).focus();
        return;
      }

      session = updateWorkoutSet(code, session, exerciseIndex, setIndex, {
        weight: weight === "" ? 0 : Number(weight),
        reps: Number(reps),
        rpe: rpe === "" ? "" : Number(rpe)
      });

      startRestTimer(exercise.restSeconds);

      button.classList.add("is-complete");
      button.textContent = "✓";
      button.closest(".set-row").classList.add("is-complete");

      const nextWeightInput = document.querySelector(`#weight-${setIndex + 1}`);
      if (nextWeightInput && nextWeightInput.value === "") {
        nextWeightInput.value = weight;
      }
    });
  });

  document.querySelector("#previous-exercise").addEventListener("click", () => {
    if (exerciseIndex > 0) {
      setCurrentExercise(code, session, exerciseIndex - 1);
      navigate(`/workout-exercise-${exerciseIndex - 1}`);
    }
  });

  document.querySelector("#next-exercise").addEventListener("click", () => {
    if (exerciseIndex < session.exercises.length - 1) {
      setCurrentExercise(code, session, exerciseIndex + 1);
      navigate(`/workout-exercise-${exerciseIndex + 1}`);
    } else {
      navigate("/workout");
    }
  });

  document.querySelector("#skip-rest").addEventListener("click", stopRestTimer);
}

export function renderWorkoutComplete() {
  const code = sessionStorage.getItem("clob_member_code");
  const session = getActiveWorkoutSession(code);

  if (!session || session.status !== "completed") {
    navigate("/member");
    return;
  }

  const duration = formatDuration(session.completedAt - session.startedAt);
  const completedSets = countCompletedSets(session);

  page(`
    <div class="completion-screen">
      <div class="completion-check">✓</div>
      <p class="eyebrow">WORKOUT COMPLETE</p>
      <h1>เยี่ยมมาก!</h1>
      <p class="subtitle">คุณทำ ${escapeHtml(session.title)} สำเร็จแล้ว</p>

      <section class="completion-summary card">
        <div>
          <span>เวลา</span>
          <strong>${duration}</strong>
        </div>
        <div>
          <span>จำนวนเซต</span>
          <strong>${completedSets}</strong>
        </div>
        <div>
          <span>จำนวนท่า</span>
          <strong>${session.exercises.length}</strong>
        </div>
      </section>

      <p class="completion-message">
        Trainer Dashboard จะเห็นสถานะ Completed และเวลาที่คุณฝึกเสร็จ
      </p>

      <button id="completion-home" class="button button-primary">กลับหน้า Today</button>
    </div>
  `, "page-center completion-page");

  document.querySelector("#completion-home").addEventListener("click", () => navigate("/member"));
}

function showToast(message) {
  const toast = document.querySelector("#workout-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 2400);
}

function startRestTimer(seconds = APP_CONFIG.defaultRestSeconds) {
  stopRestTimer();
  const overlay = document.querySelector("#rest-timer");
  const value = document.querySelector("#rest-timer-value");
  if (!overlay || !value) return;

  let remaining = Number(seconds);
  value.textContent = remaining;
  overlay.hidden = false;

  timerInterval = setInterval(() => {
    remaining -= 1;
    value.textContent = Math.max(remaining, 0);

    if (remaining <= 0) {
      stopRestTimer();
      showToast("พักครบแล้ว พร้อมเริ่มเซตถัดไป");
    }
  }, 1000);
}

function stopRestTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  const overlay = document.querySelector("#rest-timer");
  if (overlay) overlay.hidden = true;
}

function memberWorkoutNav() {
  return `
    <nav class="bottom-nav member-workout-nav" aria-label="เมนูสมาชิก">
      <button class="nav-item" data-member-route="/member"><span>⌂</span><small>Home</small></button>
      <button class="nav-item is-active" data-member-route="/workout" aria-current="page"><span>✦</span><small>Workout</small></button>
      <button class="nav-item" data-member-route="/nutrition"><span>◒</span><small>Nutrition</small></button>
      <button class="nav-item" data-member-progress><span>↗</span><small>Progress</small></button>
      <button class="nav-item" data-member-route="/member-profile"><span>○</span><small>Profile</small></button>
    </nav>
  `;
}

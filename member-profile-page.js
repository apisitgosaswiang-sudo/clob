import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import {
  createBlankWeeklyCheckin,
  loadWeeklyCheckins,
  saveWeekly,
  removeWeekly,
  loadReviews,
  saveReview,
  calculateWeeklyScore
} from "./weekly-checkins.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");
let member = null;
let checkins = [];
let reviews = {};
let editing = null;

export async function renderWeeklyCheckinPage(code) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const members = await loadMembers();
  member = getMemberByCode(members, code);
  if (!member) {
    navigate("/members");
    return;
  }

  [checkins, reviews] = await Promise.all([
    loadWeeklyCheckins(member.code),
    loadReviews(member.code)
  ]);

  render();
}

function render() {
  const submitted = checkins.filter((item) => item.reviewStatus === "submitted").length;
  const reviewed = checkins.filter((item) => item.reviewStatus === "reviewed").length;
  const averageScore = checkins.length
    ? Math.round(checkins.reduce((sum, item) => sum + calculateWeeklyScore(item), 0) / checkins.length)
    : 0;

  app.innerHTML = `
    <main class="page trainer-page">
      <div class="weekly-checkin-screen">
        <header class="weekly-header">
          <button id="weekly-back" class="back-button">←</button>
          <div>
            <p class="section-label">ONLINE COACHING</p>
            <h1>Weekly Check-ins</h1>
          </div>
          <button id="new-weekly" class="weekly-add">＋</button>
        </header>

        <section class="weekly-member card">
          ${renderAvatar({
            name: member.name,
            photoUrl: member.profilePhoto,
            className: "weekly-member-avatar"
          })}
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.code)}</span>
          </div>
          <button id="open-progress">Progress</button>
        </section>

        <section class="weekly-summary-grid">
          ${summaryCard("Submitted", submitted)}
          ${summaryCard("Reviewed", reviewed)}
          ${summaryCard("Avg. Score", `${averageScore}%`)}
        </section>

        <section class="weekly-section-head">
          <div>
            <p class="section-label">HISTORY</p>
            <h2>Weekly Timeline</h2>
          </div>
          <span>${checkins.length}</span>
        </section>

        <section class="weekly-list">
          ${checkinMarkup()}
        </section>

        <div id="weekly-modal" class="builder-modal" hidden></div>
        <div id="review-modal" class="builder-modal" hidden></div>
        <div id="weekly-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  bind();
}

function summaryCard(label, value) {
  return `
    <article class="weekly-summary-card card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function checkinMarkup() {
  if (!checkins.length) {
    return `
      <article class="weekly-empty card">
        <strong>No weekly check-in</strong>
        <p>Create the first check-in for this member.</p>
        <button id="weekly-empty-add" class="button button-primary">Add Check-in</button>
      </article>
    `;
  }

  return checkins.map((item) => {
    const review = reviews[item.id];
    const score = calculateWeeklyScore(item);
    return `
      <article class="weekly-card card">
        <button class="weekly-card-main" data-weekly-id="${escapeHtml(item.id)}">
          <div class="weekly-card-top">
            <div>
              <strong>Week of ${formatDate(item.weekStart)}</strong>
              <span>${item.reviewStatus === "reviewed" ? "Reviewed" : "Waiting for review"}</span>
            </div>
            <span class="review-badge ${item.reviewStatus === "reviewed" ? "is-reviewed" : "is-pending"}">
              ${item.reviewStatus === "reviewed" ? "Reviewed" : "Submitted"}
            </span>
          </div>

          <div class="weekly-score-row">
            <div><span>Weekly Score</span><strong>${score}%</strong></div>
            <div><span>Workout</span><strong>${Number(item.workoutAdherence || 0)}%</strong></div>
            <div><span>Nutrition</span><strong>${Number(item.nutritionAdherence || 0)}%</strong></div>
          </div>

          <div class="weekly-wellness-row">
            <span>Sleep ${Number(item.sleep || 0)}/10</span>
            <span>Stress ${Number(item.stress || 0)}/10</span>
            <span>Energy ${Number(item.energy || 0)}/10</span>
            <span>Hunger ${Number(item.hunger || 0)}/10</span>
          </div>

          ${review ? `<p class="review-preview">${escapeHtml(review.feedback || "Reviewed")}</p>` : ""}
        </button>

        <div class="weekly-card-actions">
          <button data-review-id="${escapeHtml(item.id)}">Review</button>
          <button data-delete-weekly="${escapeHtml(item.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function bind() {
  document.querySelector("#weekly-back").addEventListener("click", () => {
    navigate(`/member-detail-${member.code}`);
  });

  document.querySelector("#open-progress").addEventListener("click", () => {
    navigate(`/progress-${member.code}`);
  });

  document.querySelector("#new-weekly").addEventListener("click", () => {
    editing = createBlankWeeklyCheckin(member.code);
    openCheckinEditor(editing);
  });

  document.querySelector("#weekly-empty-add")?.addEventListener("click", () => {
    editing = createBlankWeeklyCheckin(member.code);
    openCheckinEditor(editing);
  });

  document.querySelectorAll("[data-weekly-id]").forEach((button) => {
    button.addEventListener("click", () => {
      editing = JSON.parse(JSON.stringify(
        checkins.find((item) => item.id === button.dataset.weeklyId)
      ));
      openCheckinEditor(editing);
    });
  });

  document.querySelectorAll("[data-review-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = checkins.find((entry) => entry.id === button.dataset.reviewId);
      openReviewEditor(item);
    });
  });

  document.querySelectorAll("[data-delete-weekly]").forEach((button) => {
    button.addEventListener("click", async () => {
      const item = checkins.find((entry) => entry.id === button.dataset.deleteWeekly);
      if (!window.confirm(`Delete check-in for ${formatDate(item.weekStart)}?`)) return;
      await removeWeekly(member.code, item.id);
      checkins = checkins.filter((entry) => entry.id !== item.id);
      render();
      toast("Deleted");
    });
  });
}

function openCheckinEditor(checkin) {
  const modal = document.querySelector("#weekly-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card weekly-form-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">WEEKLY CHECK-IN</p>
          <h2>${checkin.id ? "Edit Check-in" : "New Check-in"}</h2>
        </div>
        <button id="weekly-close">×</button>
      </div>

      <form id="weekly-form">
        <label class="weekly-field">
          <span>Week Start</span>
          <input name="weekStart" type="date" required value="${escapeHtml(checkin.weekStart)}">
        </label>

        <div class="weekly-two-col">
          ${metricInput("weight", "Weight", "kg", checkin.weight)}
          ${metricInput("bodyFat", "Body Fat", "%", checkin.bodyFat)}
        </div>

        ${rangeInput("sleep", "Sleep Quality", checkin.sleep)}
        ${rangeInput("stress", "Stress", checkin.stress)}
        ${rangeInput("energy", "Energy", checkin.energy)}
        ${rangeInput("hunger", "Hunger", checkin.hunger)}

        ${percentInput("workoutAdherence", "Workout Adherence", checkin.workoutAdherence)}
        ${percentInput("nutritionAdherence", "Nutrition Adherence", checkin.nutritionAdherence)}

        <div class="weekly-two-col">
          ${metricInput("stepsAverage", "Avg. Steps", "steps", checkin.stepsAverage)}
          ${metricInput("cardioMinutes", "Cardio", "min", checkin.cardioMinutes)}
        </div>

        ${textareaInput("wins", "Wins This Week", checkin.wins)}
        ${textareaInput("challenges", "Challenges", checkin.challenges)}
        ${textareaInput("coachQuestion", "Question for Coach", checkin.coachQuestion)}

        <button class="button button-primary" type="submit">Save Check-in</button>
      </form>
    </div>
  `;

  bindLiveRanges(modal);

  document.querySelector("#weekly-close").addEventListener("click", () => {
    modal.hidden = true;
  });

  document.querySelector("#weekly-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const saved = await saveWeekly(member.code, {
      ...checkin,
      weekStart: String(data.get("weekStart")),
      weight: cleanNumber(data.get("weight")),
      bodyFat: cleanNumber(data.get("bodyFat")),
      sleep: Number(data.get("sleep")),
      stress: Number(data.get("stress")),
      energy: Number(data.get("energy")),
      hunger: Number(data.get("hunger")),
      workoutAdherence: Number(data.get("workoutAdherence")),
      nutritionAdherence: Number(data.get("nutritionAdherence")),
      stepsAverage: cleanNumber(data.get("stepsAverage")),
      cardioMinutes: cleanNumber(data.get("cardioMinutes")),
      wins: String(data.get("wins")).trim(),
      challenges: String(data.get("challenges")).trim(),
      coachQuestion: String(data.get("coachQuestion")).trim(),
      reviewStatus: checkin.reviewStatus || "submitted"
    });

    const index = checkins.findIndex((item) => item.id === saved.id);
    if (index >= 0) checkins[index] = saved;
    else checkins.push(saved);

    checkins.sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
    modal.hidden = true;
    render();
    toast("Saved");
  });
}

function openReviewEditor(checkin) {
  const existing = reviews[checkin.id] || {
    feedback: "",
    nextWeekGoal: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    trainingAdjustment: "",
    status: "reviewed"
  };

  const modal = document.querySelector("#review-modal");
  modal.hidden = false;
  modal.innerHTML = `
    <div class="builder-modal-card review-form-card">
      <div class="builder-modal-head">
        <div>
          <p class="section-label">COACH REVIEW</p>
          <h2>${formatDate(checkin.weekStart)}</h2>
        </div>
        <button id="review-close">×</button>
      </div>

      <section class="member-submission-summary">
        <div><span>Workout</span><strong>${Number(checkin.workoutAdherence || 0)}%</strong></div>
        <div><span>Nutrition</span><strong>${Number(checkin.nutritionAdherence || 0)}%</strong></div>
        <div><span>Energy</span><strong>${Number(checkin.energy || 0)}/10</strong></div>
      </section>

      ${checkin.coachQuestion ? `
        <section class="member-question card">
          <span>Question from member</span>
          <p>${escapeHtml(checkin.coachQuestion)}</p>
        </section>
      ` : ""}

      <form id="review-form">
        ${textareaInput("feedback", "Coach Feedback", existing.feedback)}
        ${textareaInput("nextWeekGoal", "Goal for Next Week", existing.nextWeekGoal)}

        <div class="weekly-two-col">
          ${metricInput("calories", "Calories", "kcal", existing.calories)}
          ${metricInput("protein", "Protein", "g", existing.protein)}
        </div>

        <div class="weekly-two-col">
          ${metricInput("carbs", "Carbs", "g", existing.carbs)}
          ${metricInput("fat", "Fat", "g", existing.fat)}
        </div>

        ${textareaInput("trainingAdjustment", "Training Adjustment", existing.trainingAdjustment)}

        <button class="button button-primary" type="submit">Mark as Reviewed</button>
      </form>
    </div>
  `;

  document.querySelector("#review-close").addEventListener("click", () => {
    modal.hidden = true;
  });

  document.querySelector("#review-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const review = await saveReview(member.code, checkin.id, {
      feedback: String(data.get("feedback")).trim(),
      nextWeekGoal: String(data.get("nextWeekGoal")).trim(),
      calories: cleanNumber(data.get("calories")),
      protein: cleanNumber(data.get("protein")),
      carbs: cleanNumber(data.get("carbs")),
      fat: cleanNumber(data.get("fat")),
      trainingAdjustment: String(data.get("trainingAdjustment")).trim(),
      status: "reviewed",
      reviewedAt: Date.now()
    });

    reviews[checkin.id] = review;
    checkin.reviewStatus = "reviewed";
    modal.hidden = true;
    render();
    toast("Reviewed");
  });
}

function metricInput(name, label, unit, value) {
  return `
    <label class="weekly-field">
      <span>${escapeHtml(label)}</span>
      <div class="weekly-metric-input">
        <input name="${escapeHtml(name)}" type="number" min="0" step="0.1" value="${escapeHtml(value)}">
        <small>${escapeHtml(unit)}</small>
      </div>
    </label>
  `;
}

function rangeInput(name, label, value) {
  return `
    <label class="weekly-range-field">
      <span>${escapeHtml(label)}</span>
      <strong data-range-value="${escapeHtml(name)}">${Number(value || 0)}/10</strong>
      <input name="${escapeHtml(name)}" type="range" min="1" max="10" step="1" value="${Number(value || 5)}">
    </label>
  `;
}

function percentInput(name, label, value) {
  return `
    <label class="weekly-range-field">
      <span>${escapeHtml(label)}</span>
      <strong data-range-value="${escapeHtml(name)}">${Number(value || 0)}%</strong>
      <input name="${escapeHtml(name)}" type="range" min="0" max="100" step="5" value="${Number(value || 0)}">
    </label>
  `;
}

function textareaInput(name, label, value) {
  return `
    <label class="weekly-field">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}" rows="3">${escapeHtml(value || "")}</textarea>
    </label>
  `;
}

function bindLiveRanges(root) {
  root.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener("input", () => {
      const output = root.querySelector(`[data-range-value="${input.name}"]`);
      if (!output) return;
      output.textContent = input.max === "100" ? `${input.value}%` : `${input.value}/10`;
    });
  });
}

function cleanNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? number : "";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function toast(message) {
  const el = document.querySelector("#weekly-toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 1700);
}

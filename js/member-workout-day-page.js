import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import { getMemberWorkoutSessions } from "./firebase.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberWorkoutDayPage(code, dayKey) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const [members, remote] = await Promise.all([
    loadMembers(),
    getMemberWorkoutSessions(code)
  ]);
  const member = getMemberByCode(members, code);
  if (!member) { navigate("/members"); return; }

  const allSessions = Object.values(remote || {});
  const daySessions = allSessions
    .filter((item) => item && dayKeyOf(item) === dayKey)
    .sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));

  const dateLabel = daySessions.length
    ? new Date(Number(daySessions[0].completedAt || daySessions[0].updatedAt || Date.now())).toLocaleDateString("th-TH", { dateStyle: "full" })
    : "รายละเอียดวัน";

  app.innerHTML = `<main class="page trainer-page"><div class="member-detail-screen">
    <header class="member-detail-header">
      <button id="day-back" class="back-button" aria-label="ย้อนกลับ">←</button>
      <h1>${escapeHtml(dateLabel)}</h1><span></span>
    </header>
    <section class="member-profile-card">
      <div class="member-profile-avatar">${member.profilePhoto ? `<img src="${escapeHtml(member.profilePhoto)}" alt="">` : escapeHtml(member.name.charAt(0).toUpperCase())}</div>
      <div><h2>${escapeHtml(member.name)}</h2><small>${daySessions.length} Session ในวันนี้</small></div>
    </section>

    ${daySessions.length ? daySessions.map(sessionDetailCard).join("") : `
      <div class="members-empty card"><div>▤</div><strong>ไม่พบข้อมูลของวันนี้</strong></div>
    `}
  </div></main>`;

  document.querySelector("#day-back").onclick = () => navigate(`/member-history-${code}`);
}

function dayKeyOf(session) {
  const date = new Date(Number(session.completedAt || session.updatedAt || Date.now()));
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function sessionDetailCard(session) {
  const startTime = session.startedAt
    ? new Date(Number(session.startedAt)).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
    : "-";
  return `
    <section class="detail-card card">
      <div class="detail-card-title">
        <div><h3>${escapeHtml(session.title || "Workout")}</h3><p>เริ่ม ${startTime}</p></div>
        <span class="package-chip ${session.status === "completed" ? "package-active" : "package-expiring"}">${session.status === "completed" ? "COMPLETED" : "IN PROGRESS"}</span>
      </div>
      ${(session.exercises || []).map(exerciseRow).join("")}
    </section>
  `;
}

function exerciseRow(exercise) {
  const sets = exercise.sets || [];
  const doneSets = sets.filter((set) => set.completed);
  const skippedCount = sets.filter((set) => set.skipped).length;

  // Volume = ผลรวม (น้ำหนัก × ครั้ง) ของเซตที่ทำจริง — ตัวชี้วัดหลักว่าแข็งแรงขึ้นไหม
  const volume = doneSets.reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
  const rpeValues = doneSets.map((set) => Number(set.rpe)).filter((value) => Number.isFinite(value) && value > 0);
  const avgRpe = rpeValues.length ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1) : null;

  return `
    <div class="workout-day-exercise">
      <div class="workout-day-exercise-head">
        <strong>${escapeHtml(exercise.name)}</strong>
        <span>${doneSets.length}/${sets.length} เซต</span>
      </div>
      ${exercise.skipped ? `<p class="workout-day-skip-note">ข้ามท่านี้ · ${escapeHtml(exercise.skipReason || "อื่นๆ")}</p>` : ""}
      <div class="workout-day-sets">
        ${sets.map((set, index) => {
          if (set.skipped) return `<span class="workout-day-set-chip is-skipped">เซต ${index + 1} · ข้าม</span>`;
          if (!set.completed) return `<span class="workout-day-set-chip">เซต ${index + 1} · ยังไม่ทำ</span>`;
          const rpeLabel = Number(set.rpe) > 0 ? ` · RPE ${set.rpe}` : "";
          return `<span class="workout-day-set-chip is-done">เซต ${index + 1} · ${set.weight || 0}kg × ${set.reps || "-"}${rpeLabel}</span>`;
        }).join("")}
      </div>
      ${doneSets.length ? `
        <div class="workout-day-metrics">
          <span>Volume <strong>${Math.round(volume).toLocaleString()} kg</strong></span>
          ${avgRpe ? `<span>RPE เฉลี่ย <strong>${avgRpe}</strong></span>` : ""}
          ${skippedCount ? `<span>ข้าม <strong>${skippedCount} เซต</strong></span>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

import { navigate } from "./router.js";
import { loadMembers } from "./members.js";
import { getMemberWorkoutSessions } from "./firebase.js";
import { loadWeeklyCheckins } from "./weekly-checkins.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");

export async function renderWorkoutOverviewPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  app.innerHTML = `
    <main class="page trainer-page">
      <div class="member-loading">
        <div class="loading-spinner"></div>
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    </main>
  `;

  const members = (await loadMembers()).filter((member) => member.status === "active");

  const rows = await Promise.all(members.map(async (member) => {
    const [sessions, weekly] = await Promise.all([
      getMemberWorkoutSessions(member.code),
      loadWeeklyCheckins(member.code)
    ]);
    const completedSessions = Object.values(sessions || {}).filter((item) => item && item.status === "completed");
    const weeklyCompleted = completedSessions.filter((item) => Date.now() - Number(item.completedAt || 0) < 7 * 86400000).length;
    const latestWeekly = weekly[0] || null;
    const adherence = latestWeekly ? Number(latestWeekly.workoutAdherence || 0) : null;
    const lastSession = completedSessions.sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0))[0];
    const daysSinceLast = lastSession ? Math.floor((Date.now() - Number(lastSession.completedAt || 0)) / 86400000) : null;

    return { member, weeklyCompleted, adherence, daysSinceLast };
  }));

  // เรียงให้คนที่ต้องดูแลก่อน (adherence ต่ำสุด หรือขาดหายนานสุด) ขึ้นบนสุด
  rows.sort((a, b) => {
    const scoreA = a.adherence === null ? -1 : a.adherence;
    const scoreB = b.adherence === null ? -1 : b.adherence;
    return scoreA - scoreB;
  });

  render(rows);
}

function render(rows) {
  app.innerHTML = `
    <main class="page trainer-page">
      <div class="member-detail-screen">
        <header class="member-detail-header">
          <button id="workout-overview-back" class="back-button">←</button>
          <h1>ภาพรวม Workout</h1><span></span>
        </header>

        <p class="member-goal" style="margin:0 2px 14px;">เรียงจากคนที่ต้องดูแลก่อน (Workout ตามแผน % ต่ำสุด หรือยังไม่มีข้อมูล)</p>

        <section class="history-list">
          ${rows.length ? rows.map(rowCard).join("") : `
            <div class="members-empty card"><div>▤</div><strong>ยังไม่มีสมาชิก Active</strong></div>
          `}
        </section>
      </div>
    </main>
  `;

  document.querySelector("#workout-overview-back").onclick = () => navigate("/trainer");
  document.querySelectorAll("[data-member-code]").forEach((card) => {
    card.addEventListener("click", () => navigate(`/member-history-${card.dataset.memberCode}`));
  });
}

function rowCard({ member, weeklyCompleted, adherence, daysSinceLast }) {
  const attentionLevel = adherence === null ? "package-expiring" : adherence < 50 ? "package-expiring" : "package-active";
  const attentionLabel = adherence === null ? "ยังไม่มีข้อมูล" : `${adherence}%`;
  const lastSeen = daysSinceLast === null ? "ยังไม่เคยทำ Workout" : daysSinceLast === 0 ? "ทำวันนี้" : `${daysSinceLast} วันก่อน`;

  return `
    <button class="detail-card card" style="text-align:left;width:100%;" data-member-code="${escapeHtml(member.code)}">
      <div class="detail-card-title">
        <div><h3>${escapeHtml(member.name)}</h3><p>ทำล่าสุด ${lastSeen}</p></div>
        <span class="package-chip ${attentionLevel}">${attentionLabel}</span>
      </div>
      <div class="detail-grid">
        <div><span>Workout 7 วัน</span><strong>${weeklyCompleted} ครั้ง</strong></div>
        <div><span>Workout ตามแผน</span><strong>${attentionLabel}</strong></div>
      </div>
    </button>
  `;
}

import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import { getMemberWorkoutSessions } from "./firebase.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberHistoryPage(code) {
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

  const sessions = Object.values(remote || {})
    .filter((item) => item && (item.status === "completed" || completedSets(item) > 0))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

  app.innerHTML = `<main class="page trainer-page"><div class="member-detail-screen">
    <header class="member-detail-header">
      <button id="history-back" class="back-button">←</button>
      <h1>Workout History</h1><span></span>
    </header>
    <section class="member-profile-card">
      <div class="member-profile-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</div>
      <div><h2>${escapeHtml(member.name)}</h2><small>${sessions.length} รายการ</small></div>
    </section>
    <section class="history-list">
      ${sessions.length ? sessions.map(historyCard).join("") : `
        <div class="members-empty card"><div>▤</div><strong>ยังไม่มีประวัติการออกกำลังกาย</strong>
        <p>รายการจะปรากฏเมื่อสมาชิกเริ่มบันทึกอย่างน้อย 1 เซต</p></div>`}
    </section>
  </div></main>`;
  document.querySelector("#history-back").onclick = () => navigate(`/member-detail-${code}`);
}

function historyCard(session) {
  const done = completedSets(session);
  const total = totalSets(session);
  const date = new Date(Number(session.completedAt || session.updatedAt || Date.now()));
  return `<article class="detail-card card">
    <div class="detail-card-title"><div><h3>${escapeHtml(session.title || "Workout")}</h3>
    <p>${date.toLocaleDateString("th-TH", { dateStyle: "medium" })}</p></div>
    <span class="package-chip ${session.status === "completed" ? "package-active" : "package-expiring"}">${session.status === "completed" ? "COMPLETED" : "IN PROGRESS"}</span></div>
    <div class="detail-grid">
      <div><span>เซตที่ทำ</span><strong>${done}/${total}</strong></div>
      <div><span>ความสำเร็จ</span><strong>${total ? Math.round(done / total * 100) : 0}%</strong></div>
    </div>
  </article>`;
}

function completedSets(session) {
  return (session.exercises || []).reduce((sum, exercise) =>
    sum + (exercise.sets || []).filter((set) => set.completed).length, 0);
}

function totalSets(session) {
  return (session.exercises || []).reduce((sum, exercise) => sum + (exercise.sets || []).length, 0);
}

import { navigate } from "./router.js";
import { loadMember, loadMemberWorkoutHistory, countCompletedSets, countTotalSets } from "./member.js";

const app = document.querySelector("#app");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function renderMemberWorkoutHistoryPage() {
  const code = sessionStorage.getItem("clob_member_code");
  if (!code) {
    navigate("/");
    return;
  }

  app.innerHTML = `
    <main class="page member-page">
      <section class="member-loading">
        <div class="loading-spinner"></div>
        <p>กำลังโหลดประวัติ...</p>
      </section>
    </main>
  `;

  const [member, history] = await Promise.all([
    loadMember(code),
    loadMemberWorkoutHistory(code)
  ]);

  render(member, history);
}

function render(member, history) {
  app.innerHTML = `
    <main class="page workout-page">
      <div class="workout-screen">
        <header class="workout-topbar">
          <button id="history-back" class="back-button" aria-label="กลับ">←</button>
          <div><p>WORKOUT</p><h1>ประวัติที่ผ่านมา</h1></div>
          <span class="workout-percent">${history.length}</span>
        </header>

        <section class="history-list">
          ${history.length ? history.map(historyCard).join("") : `
            <div class="members-empty card"><div>▤</div><strong>ยังไม่มีประวัติ</strong>
            <p>ทำ Workout ให้ครบอย่างน้อย 1 ครั้งเพื่อดูประวัติที่นี่</p></div>
          `}
        </section>
      </div>
    </main>
  `;

  document.querySelector("#history-back").onclick = () => navigate("/workout");
}

function historyCard(session) {
  const done = countCompletedSets(session);
  const total = countTotalSets(session);
  const date = new Date(Number(session.completedAt || session.updatedAt || Date.now()));
  return `
    <article class="detail-card card">
      <div class="detail-card-title">
        <div>
          <h3>${escapeHtml(session.title || "Workout")}</h3>
          <p>${date.toLocaleDateString("th-TH", { dateStyle: "medium" })}</p>
        </div>
        <span class="package-chip package-active">COMPLETED</span>
      </div>
      <div class="detail-grid">
        <div><span>เซตที่ทำ</span><strong>${done}/${total}</strong></div>
        <div><span>ความสำเร็จ</span><strong>${total ? Math.round((done / total) * 100) : 0}%</strong></div>
      </div>
    </article>
  `;
}

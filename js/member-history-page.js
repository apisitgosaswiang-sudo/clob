import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import { getMemberWorkoutSessions } from "./firebase.js";
import { loadMemberProgram } from "./programs.js";
import { loadWeeklyCheckins } from "./weekly-checkins.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberHistoryPage(code) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const [members, remote, assignment, weekly] = await Promise.all([
    loadMembers(),
    getMemberWorkoutSessions(code),
    loadMemberProgram(code),
    loadWeeklyCheckins(code)
  ]);
  const member = getMemberByCode(members, code);
  if (!member) { navigate("/members"); return; }

  const allSessions = Object.values(remote || {}).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  const sessions = allSessions.filter((item) => item && (item.status === "completed" || completedSets(item) > 0));
  const completedSessions = allSessions.filter((item) => item && item.status === "completed");
  const weeklyCompleted = completedSessions.filter((item) => Date.now() - Number(item.completedAt || 0) < 7 * 86400000).length;
  const totalMinutes = completedSessions.reduce((sum, item) => sum + Math.max(0, Math.round((Number(item.completedAt || item.updatedAt || 0) - Number(item.startedAt || 0)) / 60000)), 0);
  const caloriesBurned = completedSessions.reduce((sum, item) => sum + Number(item.caloriesBurned || 0), 0);
  const latestWeekly = weekly[0] || null;

  app.innerHTML = `<main class="page trainer-page"><div class="member-detail-screen">
    <header class="member-detail-header">
      <button id="history-back" class="back-button">←</button>
      <h1>Workout</h1><span></span>
    </header>
    <section class="member-profile-card">
      <div class="member-profile-avatar">${member.profilePhoto ? `<img src="${escapeHtml(member.profilePhoto)}" alt="">` : escapeHtml(member.name.charAt(0).toUpperCase())}</div>
      <div><h2>${escapeHtml(member.name)}</h2><small>${sessions.length} Session ทั้งหมด</small></div>
    </section>

    <section class="detail-card card">
      <div class="detail-card-title"><div><h3>สรุปการฝึก</h3><p>ข้อมูลล่าสุดที่เทรนเนอร์ควรรู้</p></div></div>
      <div class="detail-grid">
        <div><span>Workout 7 วัน</span><strong>${weeklyCompleted} ครั้ง</strong></div>
        <div><span>เวลาออกกำลังรวม</span><strong>${totalMinutes ? `${totalMinutes} นาที` : "ยังไม่มีข้อมูล"}</strong></div>
        <div><span>Workout ตามแผน</span><strong>${latestWeekly ? `${Number(latestWeekly.workoutAdherence || 0)}%` : "ยังไม่มีข้อมูล"}</strong></div>
        <div><span>แคลอรีเผาผลาญ</span><strong>${caloriesBurned ? `${caloriesBurned} kcal` : "ยังไม่มีข้อมูล"}</strong></div>
      </div>
    </section>

    <section class="detail-card card">
      <div class="detail-card-title"><div><h3>คิวโปรแกรมฝึก</h3><p>${assignment.queue.length ? `${assignment.queue.length} โปรแกรมในคิว · ${escapeHtml(assignment.queue[0]?.programName || "")} เป็นต้นไป` : "ยังไม่ได้กำหนดโปรแกรม"}</p></div></div>
      <button id="open-schedule" class="button button-primary">จัดตารางเทรน</button>
    </section>

    <h3 class="history-section-label">ประวัติที่ผ่านมา</h3>
    <section class="history-list">
      ${sessions.length ? sessions.map(historyCard).join("") : `
        <div class="members-empty card"><div>▤</div><strong>ยังไม่มีประวัติการออกกำลังกาย</strong>
        <p>รายการจะปรากฏเมื่อสมาชิกเริ่มบันทึกอย่างน้อย 1 เซต</p></div>`}
    </section>
  </div></main>`;
  document.querySelector("#history-back").onclick = () => navigate(`/member-detail-${code}`);
  document.querySelector("#open-schedule").onclick = () => navigate(`/member-schedule-${code}`);
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

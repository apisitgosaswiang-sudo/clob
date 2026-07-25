import { navigate } from "./router.js";
import { loadMember, loadMemberWorkoutHistory } from "./member.js";
import { createBlankWeeklyCheckin, loadWeeklyCheckins, loadReviews, saveWeekly } from "./weekly-checkins.js";
import { toggleTask } from "./member-experience.js";
import { loadCheckins, latestValue } from "./checkins.js";
import { dateKey, loadNutritionDay } from "./nutrition.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberWeeklyUpdatePage() {
  const code = sessionStorage.getItem("clob_member_code");
  if (!code) { navigate("/"); return; }

  const [member, history, reviews, sessions, bodyCheckins] = await Promise.all([
    loadMember(code),
    loadWeeklyCheckins(code),
    loadReviews(code),
    loadMemberWorkoutHistory(code),
    loadCheckins(code)
  ]);

  const draft = createBlankWeeklyCheckin(code);
  const latestCheckin = history[0] || null;
  const latestReview = pickLatestReview(reviews);
  const adherence = await calculateAdherence(code, member, sessions);
  const currentWeight = latestValue(bodyCheckins, "weight");

  app.innerHTML = `<main class="page member-page"><div class="weekly-checkin-screen">
    <header class="weekly-header">
      <button id="weekly-back" class="back-button">←</button>
      <div><p class="section-label">WEEKLY UPDATE</p><h1>ส่งอัปเดตประจำสัปดาห์</h1></div>
    </header>

    <section class="weekly-member card">
      ${renderAvatar({ name: member.name, photoUrl: member.profilePhoto, className: "weekly-member-avatar" })}
      <div><strong>${escapeHtml(member.name)}</strong><span>${history.length} updates</span></div>
      <button id="weekly-photos">เพิ่มรูป</button>
    </section>

    ${coachReviewMarkup(latestReview, latestCheckin)}

    <form id="member-weekly-form" class="member-editor card">
      <div class="form-grid">
        <label><span>สัปดาห์เริ่มวันที่</span><input name="weekStart" type="date" required value="${draft.weekStart}"></label>
        <label><span>การนอน (1-10)</span><input name="sleep" type="number" min="1" max="10" value="7"></label>
        <label><span>ความเครียด (1-10)</span><input name="stress" type="number" min="1" max="10" value="5"></label>
        <label><span>พลังงาน (1-10)</span><input name="energy" type="number" min="1" max="10" value="5"></label>
        <label><span>ความหิว (1-10)</span><input name="hunger" type="number" min="1" max="10" value="5"></label>
      </div>

      <div class="weekly-auto-summary">
        <p class="weekly-auto-title">ระบบสรุปให้อัตโนมัติจากข้อมูลที่คุณบันทึกไว้</p>
        <div class="weekly-auto-grid">
          <div><span>น้ำหนักล่าสุด</span><strong>${currentWeight === null ? "ยังไม่บันทึก" : `${currentWeight} kg`}</strong></div>
          <div><span>Workout ตามแผน</span><strong>${adherence.workout}%</strong></div>
          <div><span>โภชนาการตามแผน</span><strong>${adherence.nutrition}%</strong></div>
        </div>
        ${currentWeight === null ? `<button type="button" id="go-log-weight" class="weekly-auto-link">ไปบันทึกน้ำหนัก →</button>` : ""}
      </div>

      <label class="form-wide"><span>สิ่งที่ทำได้ดี</span><textarea name="wins" rows="3"></textarea></label>
      <label class="form-wide"><span>ปัญหาหรืออุปสรรค</span><textarea name="challenges" rows="3"></textarea></label>
      <label class="form-wide"><span>คำถามถึงโค้ช</span><textarea name="coachQuestion" rows="3"></textarea></label>
      <button class="button button-primary" type="submit">ส่ง Weekly Update</button>
    </form>

    <section class="card">
      <strong>รูป Weekly Update</strong>
      <p>กด "เพิ่มรูป" เพื่ออัปโหลด Front / Side / Back ด้วยตนเอง รูปจะเชื่อมกับประวัติ Progress ของคุณ</p>
    </section>

    <div id="weekly-member-toast" class="toast" hidden></div>
  </div></main>`;

  if (latestReview?.id) {
    localStorage.setItem(`clob_seen_review_${code}`, String(latestReview.id));
  }

  document.querySelector("#weekly-back").onclick = () => navigate("/member");
  document.querySelector("#weekly-photos").onclick = () => navigate(`/progress-photos-${code}`);
  document.querySelector("#go-log-weight")?.addEventListener("click", () => navigate(`/member-progress-${code}`));

  document.querySelector("#member-weekly-form").onsubmit = async (event) => {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await saveWeekly(code, {
        ...draft,
        weekStart: d.get("weekStart"),
        weight: currentWeight === null ? "" : currentWeight,
        sleep: Number(d.get("sleep")),
        stress: Number(d.get("stress")),
        energy: Number(d.get("energy")),
        hunger: Number(d.get("hunger")),
        workoutAdherence: adherence.workout,
        nutritionAdherence: adherence.nutrition,
        wins: String(d.get("wins") || "").trim(),
        challenges: String(d.get("challenges") || "").trim(),
        coachQuestion: String(d.get("coachQuestion") || "").trim(),
        reviewStatus: "submitted"
      });
      await toggleTask(code, "checkin", true);
      const toast = document.querySelector("#weekly-member-toast");
      toast.textContent = "ส่ง Weekly Update แล้ว";
      toast.hidden = false;
      setTimeout(() => navigate("/member"), 700);
    } catch (error) {
      const toast = document.querySelector("#weekly-member-toast");
      toast.textContent = error?.message || "ส่งข้อมูลไม่สำเร็จ";
      toast.hidden = false;
      button.disabled = false;
    }
  };
}

// เลือกรีวิวล่าสุดที่โค้ชเขียนไว้ (เก็บเป็น object ตาม checkinId)
function pickLatestReview(reviews) {
  const list = Object.values(reviews || {}).filter((item) => item && item.status === "reviewed");
  if (!list.length) return null;
  return list.sort((a, b) => Number(b.reviewedAt || 0) - Number(a.reviewedAt || 0))[0];
}

function coachReviewMarkup(review, latestCheckin) {
  const waiting = latestCheckin?.reviewStatus === "submitted";

  if (!review) {
    return `<section class="coach-review-card card is-waiting">
      <p class="section-label">จากโค้ช</p>
      <strong>${waiting ? "โค้ชกำลังตรวจรายงานของคุณ" : "ยังไม่มีคำติชมจากโค้ช"}</strong>
      <p>${waiting ? "ส่งแล้ว รอโค้ชรีวิว จะแจ้งให้ทราบเมื่อมีคำตอบ" : "ส่ง Weekly Update เพื่อรับคำแนะนำจากโค้ช"}</p>
    </section>`;
  }

  const date = review.reviewedAt
    ? new Date(Number(review.reviewedAt)).toLocaleDateString("th-TH", { dateStyle: "medium" })
    : "";

  return `<section class="coach-review-card card">
    <div class="coach-review-head">
      <div><p class="section-label">จากโค้ช</p><strong>คำติชมล่าสุด</strong></div>
      ${date ? `<span class="coach-review-date">${escapeHtml(date)}</span>` : ""}
    </div>

    ${review.feedback ? `<div class="coach-review-block"><span>คำติชม</span><p>${escapeHtml(review.feedback)}</p></div>` : ""}
    ${review.nextWeekGoal ? `<div class="coach-review-block"><span>เป้าหมายสัปดาห์หน้า</span><p>${escapeHtml(review.nextWeekGoal)}</p></div>` : ""}
    ${review.trainingAdjustment ? `<div class="coach-review-block"><span>ปรับโปรแกรมเทรน</span><p>${escapeHtml(review.trainingAdjustment)}</p></div>` : ""}
    ${Number(review.calories) > 0 ? `
      <div class="coach-review-block">
        <span>เป้าหมายโภชนาการที่โค้ชปรับให้</span>
        <p>${Math.round(Number(review.calories))} kcal · P ${Math.round(Number(review.protein || 0))}g · C ${Math.round(Number(review.carbs || 0))}g · F ${Math.round(Number(review.fat || 0))}g</p>
      </div>
    ` : ""}
  </section>`;
}

// คำนวณ % การทำตามแผนจากข้อมูลจริง ไม่ต้องให้ลูกเทรนเดาเอง
async function calculateAdherence(code, member, sessions) {
  const weekAgo = Date.now() - 7 * 86400000;

  const completedThisWeek = (sessions || []).filter((item) =>
    item && item.status === "completed" && Number(item.completedAt || 0) >= weekAgo
  ).length;

  // จำนวนวันที่ควรทำ = จำนวนโปรแกรมในคิว (Day 1..N) ถ้าไม่มีข้อมูลใช้ 3 เป็นค่ากลาง
  const expected = Math.max(Number(member?.workout?.queueLength) || 3, 1);
  const workout = Math.min(100, Math.round((completedThisWeek / expected) * 100));

  // โภชนาการ: นับวันที่บันทึกอาหารอย่างน้อย 1 มื้อ ใน 7 วันล่าสุด
  let loggedDays = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    try {
      const data = await loadNutritionDay(code, dateKey(day));
      if ((data?.meals || []).length > 0) loggedDays += 1;
    } catch {
      // ข้ามวันที่โหลดไม่ได้
    }
  }
  const nutrition = Math.round((loggedDays / 7) * 100);

  return { workout, nutrition };
}

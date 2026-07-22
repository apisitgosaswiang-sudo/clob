import { navigate } from "./router.js";
import { loadMember } from "./member.js";
import { createBlankWeeklyCheckin, loadWeeklyCheckins, saveWeekly } from "./weekly-checkins.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberWeeklyUpdatePage() {
  const code = sessionStorage.getItem("clob_member_code");
  if (!code) { navigate("/"); return; }
  const [member, history] = await Promise.all([loadMember(code), loadWeeklyCheckins(code)]);
  const draft = createBlankWeeklyCheckin(code);
  app.innerHTML = `<main class="page member-page"><div class="weekly-checkin-screen">
    <header class="weekly-header"><button id="weekly-back" class="back-button">←</button><div><p class="section-label">WEEKLY UPDATE</p><h1>ส่งอัปเดตประจำสัปดาห์</h1></div></header>
    <section class="weekly-member card">${renderAvatar({name:member.name,photoUrl:member.profilePhoto,className:"weekly-member-avatar"})}<div><strong>${escapeHtml(member.name)}</strong><span>${history.length} updates</span></div><button id="weekly-photos">เพิ่มรูป</button></section>
    <form id="member-weekly-form" class="member-editor card">
      <div class="form-grid">
        <label><span>สัปดาห์เริ่มวันที่</span><input name="weekStart" type="date" required value="${draft.weekStart}"></label>
        <label><span>น้ำหนัก (kg)</span><input name="weight" type="number" step="0.1"></label>
        <label><span>การนอน (1-10)</span><input name="sleep" type="number" min="1" max="10" value="7"></label>
        <label><span>ความเครียด (1-10)</span><input name="stress" type="number" min="1" max="10" value="5"></label>
        <label><span>พลังงาน (1-10)</span><input name="energy" type="number" min="1" max="10" value="5"></label>
        <label><span>ความหิว (1-10)</span><input name="hunger" type="number" min="1" max="10" value="5"></label>
        <label><span>ทำ Workout ตามแผน (%)</span><input name="workoutAdherence" type="number" min="0" max="100" value="0"></label>
        <label><span>ทำโภชนาการตามแผน (%)</span><input name="nutritionAdherence" type="number" min="0" max="100" value="0"></label>
      </div>
      <label class="form-wide"><span>สิ่งที่ทำได้ดี</span><textarea name="wins" rows="3"></textarea></label>
      <label class="form-wide"><span>ปัญหาหรืออุปสรรค</span><textarea name="challenges" rows="3"></textarea></label>
      <label class="form-wide"><span>คำถามถึงโค้ช</span><textarea name="coachQuestion" rows="3"></textarea></label>
      <button class="button button-primary" type="submit">ส่ง Weekly Update</button>
    </form>
    <section class="card"><strong>รูป Weekly Update</strong><p>กด “เพิ่มรูป” เพื่ออัปโหลด Front / Side / Back ด้วยตนเอง รูปจะเชื่อมกับประวัติ Progress ของคุณ</p></section>
    <div id="weekly-member-toast" class="toast" hidden></div>
  </div></main>`;
  document.querySelector("#weekly-back").onclick=()=>navigate("/member");
  document.querySelector("#weekly-photos").onclick=()=>navigate(`/progress-photos-${code}`);
  document.querySelector("#member-weekly-form").onsubmit=async (event)=>{
    event.preventDefault(); const d=new FormData(event.currentTarget); const button=event.currentTarget.querySelector("button"); button.disabled=true;
    try {
      await saveWeekly(code,{...draft,weekStart:d.get("weekStart"),weight:d.get("weight"),sleep:Number(d.get("sleep")),stress:Number(d.get("stress")),energy:Number(d.get("energy")),hunger:Number(d.get("hunger")),workoutAdherence:Number(d.get("workoutAdherence")),nutritionAdherence:Number(d.get("nutritionAdherence")),wins:String(d.get("wins")||"").trim(),challenges:String(d.get("challenges")||"").trim(),coachQuestion:String(d.get("coachQuestion")||"").trim(),reviewStatus:"submitted"});
      const toast=document.querySelector("#weekly-member-toast");toast.textContent="ส่ง Weekly Update แล้ว";toast.hidden=false;setTimeout(()=>navigate("/member"),700);
    } catch(error){ const toast=document.querySelector("#weekly-member-toast");toast.textContent=error?.message||"ส่งข้อมูลไม่สำเร็จ";toast.hidden=false;button.disabled=false; }
  };
}

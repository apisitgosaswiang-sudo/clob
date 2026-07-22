import { navigate } from "./router.js";
import { loadMember } from "./member.js";
import { escapeHtml, renderAvatar } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberProfilePage() {
  const code = sessionStorage.getItem("clob_member_code");
  if (!code) {
    navigate("/");
    return;
  }

  const member = await loadMember(code);

  app.innerHTML = `
    <main class="page member-page">
      <div class="member-profile-screen">
        <header class="member-profile-head">
          <button id="profile-back" class="back-button">←</button>
          <div>
            <p class="section-label">ACCOUNT</p>
            <h1>Profile</h1>
          </div>
        </header>

        <section class="member-profile-card card">
          ${renderAvatar({
            name: member.name,
            photoUrl: member.profilePhoto,
            className: "member-profile-avatar"
          })}
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <span>Member ID ${escapeHtml(code)}</span>
          </div>
        </section>

        <section class="member-profile-info card">
          <div><span>Coach</span><strong>${escapeHtml(member.coachName)}</strong></div>
          <div><span>Package remaining</span><strong>${Number(member.package.daysLeft || 0)} days</strong></div>
          <div><span>Billing cycle</span><strong>Monthly</strong></div>
        </section>

        <section class="beta-privacy-card card">
          <p class="section-label">BETA DATA POLICY</p>
          <h2>ข้อมูลหลักยังอยู่ที่เดิม</h2>
          <p>
            Pack10 บันทึก Daily Habits และ Today Tasks ใน path ใหม่
            <code>clob/v1/memberExperience</code> โดยไม่ย้ายหรือลบข้อมูล Workout,
            Progress, Check-in และ Program เดิม
          </p>
        </section>

        <button id="member-logout" class="button button-secondary">ออกจากระบบ</button>
      </div>
    </main>
  `;

  document.querySelector("#profile-back").addEventListener("click", () => navigate("/member"));
  document.querySelector("#member-logout").addEventListener("click", () => {
    sessionStorage.removeItem("clob_member_code");
    navigate("/");
  });
}

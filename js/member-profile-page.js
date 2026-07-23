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

        <button id="change-profile-photo" class="button button-secondary">เพิ่มหรือเปลี่ยนรูปส่วนตัว</button>

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
      <nav class="bottom-nav clob-member-bottom-nav" aria-label="เมนูสมาชิก">
        <button class="nav-item" data-member-nav="home"><span>⌂</span><small>Home</small></button>
        <button class="nav-item" data-member-nav="workout"><span>✦</span><small>Workout</small></button>
        <button class="nav-item" data-member-nav="nutrition"><span>◒</span><small>Nutrition</small></button>
        <button class="nav-item" data-member-nav="progress"><span>↗</span><small>Progress</small></button>
        <button class="nav-item is-active" data-member-nav="profile" aria-current="page"><span>○</span><small>Profile</small></button>
      </nav>
    </main>
  `;

  document.querySelector("#profile-back").addEventListener("click", () => navigate("/member"));
  document.querySelector("#change-profile-photo").addEventListener("click", () => navigate(`/progress-photos-${code}`));
  document.querySelectorAll("[data-member-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.memberNav;
      if (target === "home") navigate("/member");
      if (target === "workout") navigate("/workout");
      if (target === "nutrition") navigate("/nutrition");
      if (target === "progress") navigate(`/member-progress-${code}`);
      if (target === "profile") navigate("/member-profile");
    });
  });
  document.querySelector("#member-logout").addEventListener("click", () => {
    sessionStorage.removeItem("clob_member_code");
    navigate("/");
  });
}

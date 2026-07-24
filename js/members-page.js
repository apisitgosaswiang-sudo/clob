import { navigate } from "./router.js";
import {
  loadMembers,
  getMemberByCode,
  packageStatus,
  sortMembers,
  deleteMember
} from "./members.js";
import { trainerResetMemberPin } from "./member-security.js";
import { loadWeeklyCheckins } from "./weekly-checkins.js";
import { loadCheckins, latestValue, calculateChange } from "./checkins.js";
import { loadPrograms, assignProgram, loadMemberProgram, unassignProgram } from "./programs.js";
import { getMemberWorkoutSessions } from "./firebase.js";
import { dateKey, loadNutritionDay } from "./nutrition.js";

const app = document.querySelector("#app");
let membersCache = [];
let currentFilter = "all";
let currentSort = "name";
let currentQuery = "";

function page(content, extraClass = "") {
  app.innerHTML = `<main class="page ${extraClass}">${content}</main>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filterMembers() {
  let items = [...membersCache];

  if (currentFilter === "active") {
    items = items.filter((member) => member.status === "active");
  } else if (currentFilter === "inactive") {
    items = items.filter((member) => member.status === "inactive");
  } else if (currentFilter === "expiring") {
    items = items.filter((member) => packageStatus(member) === "expiring");
  }

  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    items = items.filter((member) =>
      member.name.toLowerCase().includes(q) ||
      member.code.includes(q) ||
      member.phone.toLowerCase().includes(q)
    );
  }

  return sortMembers(items, currentSort);
}

function memberListMarkup(items) {
  if (!items.length) {
    return `
      <div class="members-empty card">
        <div>👤</div>
        <strong>ไม่พบสมาชิก</strong>
        <p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
      </div>
    `;
  }

  return items.map((member) => {
    const pkgStatus = packageStatus(member);
    return `
      <button class="member-row card" data-member-code="${member.code}">
        <span class="member-row-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</span>
        <span class="member-row-copy">
          <strong>${escapeHtml(member.name)}</strong>
          <small>${escapeHtml(member.packageName)}</small>
          <em>${member.status === "active" ? "● Active" : "● Inactive"}</em>
        </span>
        <span class="member-row-package">
          <strong>${member.packageDaysLeft}</strong>
          <small>วัน</small>
          <em class="package-${pkgStatus}">${pkgStatus}</em>
        </span>
        <span class="member-row-arrow">›</span>
      </button>
    `;
  }).join("");
}

function bindMemberRows() {
  document.querySelectorAll("[data-member-code]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(`/member-detail-${button.dataset.memberCode}`);
    });
  });
}

function refreshList() {
  const container = document.querySelector("#members-list");
  if (!container) return;
  container.innerHTML = memberListMarkup(filterMembers());
  bindMemberRows();

  const resultCount = document.querySelector("#member-result-count");
  if (resultCount) resultCount.textContent = `${filterMembers().length} คน`;
}

export async function renderMembersPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  page(`
    <section class="trainer-loading">
      <div class="brand">
        <span class="brand-mark">M</span>
        <span class="brand-lockup"><span>Morning Warrior</span></span>
      </div>
      <div class="loading-spinner"></div>
      <p>กำลังโหลดสมาชิก...</p>
    </section>
  `);

  membersCache = await loadMembers();

  page(`
    <div class="members-screen">
      <header class="members-header">
        <div>
          <p class="section-label">TRAINER</p>
          <h1>Members</h1>
        </div>
        <button id="add-member-button" class="add-member-button">＋ เพิ่มสมาชิก</button>
      </header>

      <section class="member-search-wrap">
        <span>⌕</span>
        <input id="member-search" type="search" placeholder="ค้นหาชื่อ รหัส หรือเบอร์โทร..." />
        <button id="sort-button" aria-label="เรียงลำดับ">⇅</button>
      </section>

      <section class="member-filter-tabs">
        <button class="member-filter is-active" data-filter="all">ทั้งหมด ${membersCache.length}</button>
        <button class="member-filter" data-filter="active">Active</button>
        <button class="member-filter" data-filter="inactive">Inactive</button>
        <button class="member-filter" data-filter="expiring">ใกล้หมด</button>
      </section>

      <div class="member-list-heading">
        <strong>รายชื่อสมาชิก</strong>
        <span id="member-result-count">${membersCache.length} คน</span>
      </div>

      <section id="members-list" class="members-list">
        ${memberListMarkup(membersCache)}
      </section>

      <div id="members-toast" class="toast" hidden></div>

      <nav class="bottom-nav trainer-bottom-nav" aria-label="เมนูเทรนเนอร์">
        <button class="nav-item" data-route="/trainer">
          <span>⌂</span>
          <small>Dashboard</small>
        </button>
        <button class="nav-item is-active" data-route="/members">
          <span>👥</span>
          <small>Members</small>
        </button>
        <button class="nav-item" data-route="/programs">
          <span>▤</span>
          <small>Programs</small>
        </button>
        <button class="nav-item" data-route="/library">
          <span>✦</span>
          <small>Library</small>
        </button>
        <button class="nav-item" data-route="/trainer-settings">
          <span>⚙</span>
          <small>Settings</small>
        </button>
      </nav>
    </div>
  `, "trainer-page");

  bindMemberRows();

  const toast = (message) => {
    const el = document.querySelector("#members-toast");
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2400);
  };

  document.querySelector("#member-search").addEventListener("input", (event) => {
    currentQuery = event.target.value.trim();
    refreshList();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      refreshList();
    });
  });

  document.querySelector("#sort-button").addEventListener("click", () => {
    const choices = ["name", "days", "recent"];
    const index = choices.indexOf(currentSort);
    currentSort = choices[(index + 1) % choices.length];
    const labels = {
      name: "เรียงตามชื่อ",
      days: "เรียงตามวันแพ็กเกจคงเหลือ",
      recent: "เรียงตามกิจกรรมล่าสุด"
    };
    toast(labels[currentSort]);
    refreshList();
  });

  document.querySelector("#add-member-button").addEventListener("click", () => {
    navigate("/member-add");
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
}

export async function renderMemberDetail(code) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  if (!membersCache.length) {
    membersCache = await loadMembers();
  }

  const member = getMemberByCode(membersCache, code);
  if (!member) {
    navigate("/members");
    return;
  }

  const [weekly, bodyCheckins, remoteSessions, programs, assignedProgram, nutritionDay] = await Promise.all([
    loadWeeklyCheckins(code),
    loadCheckins(code),
    getMemberWorkoutSessions(code),
    loadPrograms(),
    loadMemberProgram(code),
    loadNutritionDay(code, dateKey())
  ]);
  const sessions = Object.values(remoteSessions || {}).sort((a,b) => Number(b.updatedAt||0)-Number(a.updatedAt||0));
  const completedSessions = sessions.filter((item) => item.status === "completed");
  const latestWeekly = weekly[0] || null;
  const currentWeight = latestValue(bodyCheckins, "weight");
  const weightChange = calculateChange(bodyCheckins, "weight");
  const bodyFat = latestValue(bodyCheckins, "bodyFat");
  const muscle = latestValue(bodyCheckins, "skeletalMuscle");
  const waist = latestValue(bodyCheckins, "waist");
  const weeklyCompleted = completedSessions.filter((item) => Date.now() - Number(item.completedAt || 0) < 7 * 86400000).length;
  const totalMinutes = completedSessions.reduce((sum, item) => sum + Math.max(0, Math.round((Number(item.completedAt||item.updatedAt||0)-Number(item.startedAt||0))/60000)), 0);

  const hasPackage = member.packageName && member.packageName !== "No Package";
  const pkgStatus = packageStatus(member);
  const packageProgress = hasPackage && member.packageDaysLeft > 0
    ? Math.min(100, Math.round((30-member.packageDaysLeft)/30*100))
    : 0;

  page(`
    <div class="member-detail-screen">
      <header class="member-detail-header">
        <button id="member-detail-back" class="back-button" aria-label="กลับ">←</button>
        <h1>Member Detail</h1>
        <button id="member-actions" class="button button-text" aria-label="จัดการสมาชิก">⋮</button>
      </header>

      <section class="member-profile-card">
        <div class="member-profile-avatar">${member.profilePhoto
          ? `<img src="${escapeHtml(member.profilePhoto)}" alt="">`
          : escapeHtml(member.name.charAt(0).toUpperCase())}</div>
        <div>
          <h2>${escapeHtml(member.name)}</h2>
          <p><span class="profile-status-dot ${member.status}"></span>${member.status === "active" ? "Active" : "Inactive"}</p>
          <small>${escapeHtml(member.phone)}</small>
        </div>
      </section>

      <section class="detail-tabs">
        <button class="is-active">ภาพรวม</button>
        <button id="weekly-checkin-tab">Weekly</button>
        <button id="nutrition-tab">Nutrition</button>
        <button id="progress-tab">Progress</button>
        <button id="progress-photo-tab">Photos</button>
        <button id="package-tab">Package</button>
      </section>

      <section class="detail-card card member-overview-card">
        <div class="detail-card-title"><div><h3>ภาพรวมลูกเทรน</h3><p>ข้อมูลล่าสุดที่เทรนเนอร์ควรรู้</p></div>
        <span class="package-chip ${latestWeekly?.reviewStatus === "submitted" ? "package-expiring" : "package-active"}">${latestWeekly?.reviewStatus === "submitted" ? "รอรีวิว" : "อัปเดตแล้ว"}</span></div>
        <div class="detail-grid">
          <div><span>Workout 7 วัน</span><strong>${weeklyCompleted} ครั้ง</strong></div>
          <div><span>เวลาออกกำลังรวม</span><strong>${totalMinutes ? `${totalMinutes} นาที` : "ยังไม่มีข้อมูล"}</strong></div>
          <div><span>น้ำหนักล่าสุด</span><strong>${currentWeight === null ? "ยังไม่มีข้อมูล" : `${currentWeight} kg`}</strong></div>
          <div><span>แนวโน้มน้ำหนัก</span><strong>${weightChange === null ? "ยังไม่มีข้อมูล" : `${weightChange > 0 ? "+" : ""}${weightChange} kg`}</strong></div>
          <div><span>Workout ตามแผน</span><strong>${latestWeekly ? `${Number(latestWeekly.workoutAdherence || 0)}%` : "ยังไม่มีข้อมูล"}</strong></div>
          <div><span>โภชนาการตามแผน</span><strong>${latestWeekly ? `${Number(latestWeekly.nutritionAdherence || 0)}%` : "ยังไม่มีข้อมูล"}</strong></div>
          <div><span>แคลอรีวันนี้</span><strong>${nutritionDay?.target ? `${Math.round(Number(nutritionDay.summary.calories || 0))}/${Math.round(Number(nutritionDay.target.calories || 0))} kcal` : "ยังไม่มีข้อมูล"}</strong></div>
          <div><span>แคลอรีเผาผลาญ</span><strong>${completedSessions.some((item) => Number(item.caloriesBurned) > 0) ? `${completedSessions.reduce((sum,item)=>sum+Number(item.caloriesBurned||0),0)} kcal` : "ยังไม่มีข้อมูล"}</strong></div>
          <div><span>Body Fat</span><strong>${bodyFat === null ? "ยังไม่มีข้อมูล" : `${bodyFat}%`}</strong></div>
          <div><span>กล้ามเนื้อ</span><strong>${muscle === null ? "ยังไม่มีข้อมูล" : `${muscle} kg`}</strong></div>
          <div><span>รอบเอว</span><strong>${waist === null ? "ยังไม่มีข้อมูล" : `${waist} cm`}</strong></div>
        </div>
        ${latestWeekly ? `<p class="member-goal">นอน ${Number(latestWeekly.sleep || 0)}/10 · ความเครียด ${Number(latestWeekly.stress || 0)}/10 · พลังงาน ${Number(latestWeekly.energy || 0)}/10</p>` : `<p class="member-goal">ยังไม่มี Weekly Check-in</p>`}
      </section>

      <section class="detail-card card">
        <div class="detail-card-title"><div><h3>โปรแกรมฝึก</h3><p>${escapeHtml(assignedProgram?.programName || "ยังไม่ได้กำหนดโปรแกรม")}</p></div></div>
        <label class="form-wide"><span>เลือกโปรแกรม</span><select id="member-program-select">
          <option value="">เลือก Program</option>
          ${programs.filter((p) => p.status !== "archived").map((p) => `<option value="${escapeHtml(p.id)}" ${assignedProgram?.programId === p.id ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
        </select></label>
        <div class="member-program-actions">
          <button id="assign-member-program" class="button button-primary">กำหนด / เปลี่ยนโปรแกรม</button>
          ${assignedProgram ? `<button id="remove-member-program" class="button button-secondary">นำโปรแกรมออก</button>` : ""}
        </div>
      </section>

      <section class="detail-card card">
        <h3>เป้าหมาย</h3>
        <p class="member-goal">${escapeHtml(member.goal)}</p>
      </section>

      <section class="detail-card card">
        <div class="detail-card-title">
          <div>
            <h3>แพ็กเกจปัจจุบัน</h3>
            <p>${escapeHtml(member.packageName)}</p>
          </div>
          <span class="package-chip package-${pkgStatus}">${pkgStatus}</span>
        </div>

        <div class="package-dates">
          <div><span>เริ่มต้น</span><strong>${member.packageStartDate}</strong></div>
          <div><span>หมดอายุ</span><strong>${member.packageEndDate}</strong></div>
          <div><span>คงเหลือ</span><strong>${member.packageDaysLeft} วัน</strong></div>
        </div>

        <div class="package-progress-track">
          <div style="width:${packageProgress}%"></div>
        </div>
        <small>${hasPackage ? `${escapeHtml(member.packageBillingCycle === "quarterly" ? "Online Coaching 3 เดือน" : "Online Coaching รายเดือน")} · ${member.packageRenewal === "auto" ? "Auto renew" : "Manual renew"}` : "ยังไม่ได้กำหนดแพ็กเกจ"}</small>
        <button id="manage-package" class="button button-primary" type="button">${hasPackage ? "แก้ไข / ต่ออายุแพ็กเกจ" : "เลือกแพ็กเกจให้สมาชิก"}</button>
      </section>

      <section class="detail-card card">
        <div class="detail-card-title">
          <div>
            <h3>ความปลอดภัย</h3>
            <p>${member.security?.pinHash ? "ตั้ง PIN แล้ว" : "ยังไม่ได้ตั้ง PIN"}</p>
          </div>
          <span class="package-chip ${member.security?.pinHash ? "package-active" : "package-expiring"}">${member.security?.pinHash ? "PIN READY" : "NO PIN"}</span>
        </div>
        <small>Trainer ไม่สามารถดู PIN เดิมได้ หากสมาชิกลืม PIN ให้รีเซ็ตเพื่อให้ตั้งใหม่ตอนเข้าสู่ระบบครั้งถัดไป</small>
        <button id="reset-member-pin" class="button button-secondary" type="button" ${member.security?.pinHash ? "" : "disabled"}>รีเซ็ต PIN</button>
      </section>

      <section class="detail-card card">
        <h3>Workout ล่าสุด</h3>
        <div class="latest-workout-row">
          <div>
            <strong>${escapeHtml(member.workoutTitle)}</strong>
            <span>${member.workoutStatus.replace("_", " ")}</span>
          </div>
          <button id="view-history">ดูประวัติ</button>
        </div>
      </section>

      <div id="member-detail-toast" class="toast" hidden></div>
      <div id="member-action-sheet" class="builder-modal" hidden>
        <div class="builder-modal-card"><h2>จัดการ ${escapeHtml(member.name)}</h2>
          <button id="edit-member" class="button button-secondary">แก้ไขข้อมูล</button>
          <button id="delete-member" class="button button-danger">ลบสมาชิก</button>
          <button id="close-member-actions" class="button button-text">ยกเลิก</button>
        </div>
      </div>
    </div>
  `, "trainer-page");

  const toast = (message) => {
    const el = document.querySelector("#member-detail-toast");
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2400);
  };

  document.querySelector("#member-detail-back").addEventListener("click", () => navigate("/members"));
  document.querySelector("#member-actions").addEventListener("click", () => document.querySelector("#member-action-sheet").hidden = false);
  document.querySelector("#close-member-actions").addEventListener("click", () => document.querySelector("#member-action-sheet").hidden = true);
  document.querySelector("#edit-member").addEventListener("click", () => navigate(`/member-edit-${member.code}`));
  document.querySelector("#delete-member").addEventListener("click", async () => {
    if (!window.confirm(`ยืนยันลบ “${member.name}” หรือไม่? ข้อมูลที่ผูกกับสมาชิกจะถูกลบด้วย`)) return;
    const typed = window.prompt(`พิมพ์ชื่อ ${member.name} เพื่อยืนยัน`);
    if (typed !== member.name) { toast("ชื่อยืนยันไม่ตรงกัน จึงยังไม่ลบสมาชิก"); return; }
    try { await deleteMember(member.code); membersCache = membersCache.filter((item) => item.code !== member.code); navigate("/members"); }
    catch (error) { toast(error.message || "ลบสมาชิกไม่สำเร็จ"); }
  });
  document.querySelector("#weekly-checkin-tab").addEventListener("click", () => navigate(`/weekly-checkins-${member.code}`));
  document.querySelector("#nutrition-tab").addEventListener("click", () => navigate(`/trainer-nutrition-${member.code}`));
  document.querySelector("#progress-tab").addEventListener("click", () => navigate(`/progress-${member.code}`));
  document.querySelector("#progress-photo-tab").addEventListener("click", () => navigate(`/progress-photos-${member.code}`));
  document.querySelector("#package-tab")?.addEventListener("click", () => navigate(`/member-package-${member.code}`));
  document.querySelector("#manage-package")?.addEventListener("click", () => navigate(`/member-package-${member.code}`));
  document.querySelector("#reset-member-pin")?.addEventListener("click", async () => {
    if (!window.confirm(`รีเซ็ต PIN ของ ${member.name} ใช่หรือไม่?`)) return;
    const button = document.querySelector("#reset-member-pin");
    button.disabled = true;
    button.textContent = "กำลังรีเซ็ต...";
    try {
      await trainerResetMemberPin(member.code);
      member.security = null;
      toast("รีเซ็ต PIN แล้ว สมาชิกจะตั้ง PIN ใหม่เมื่อเข้าสู่ระบบครั้งถัดไป");
      setTimeout(() => renderMemberDetail(member.code), 700);
    } catch (error) {
      toast(error.message || "รีเซ็ต PIN ไม่สำเร็จ");
      button.disabled = false;
      button.textContent = "รีเซ็ต PIN";
    }
  });
  document.querySelector("#view-history")?.addEventListener("click", () => navigate(`/member-history-${member.code}`));
  document.querySelector("#assign-member-program")?.addEventListener("click", async () => {
    const program = programs.find((item) => item.id === document.querySelector("#member-program-select").value);
    if (!program) { toast("กรุณาเลือก Program"); return; }
    try { await assignProgram(program, member.code, new Date().toISOString().slice(0,10)); toast("กำหนดโปรแกรมเรียบร้อย"); setTimeout(() => renderMemberDetail(member.code), 500); }
    catch (error) { toast(error.message || "กำหนดโปรแกรมไม่สำเร็จ"); }
  });
  document.querySelector("#remove-member-program")?.addEventListener("click", async () => {
    if (!window.confirm(`นำ ${assignedProgram?.programName || "Program"} ออกจาก ${member.name} หรือไม่?`)) return;
    try { await unassignProgram(member.code); toast("นำโปรแกรมออกแล้ว"); setTimeout(() => renderMemberDetail(member.code), 500); }
    catch (error) { toast(error.message || "นำโปรแกรมออกไม่สำเร็จ"); }
  });
}

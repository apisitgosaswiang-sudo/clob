import { navigate } from "./router.js";
import {
  loadMembers,
  getMemberByCode,
  packageStatus,
  sortMembers
} from "./members.js";

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
        <span class="brand-mark">C</span>
        <span>CLOB</span>
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
        <button id="edit-member" class="button button-text">แก้ไข</button>
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
        <button class="is-active">Info</button>
        <button id="weekly-checkin-tab">Weekly</button>
        <button id="progress-tab">Progress</button>
        <button id="progress-photo-tab">Photos</button>
        <button id="package-tab">Package</button>
      </section>

      <section class="detail-card card">
        <h3>ข้อมูลส่วนตัว</h3>
        <div class="detail-grid">
          <div><span>รหัสสมาชิก</span><strong>${member.code}</strong></div>
          <div><span>วันที่สมัคร</span><strong>${member.joinedAt}</strong></div>
          <div><span>เพศ</span><strong>${member.gender}</strong></div>
          <div><span>อายุ</span><strong>${member.age}</strong></div>
          <div><span>น้ำหนัก</span><strong>${member.weight} kg</strong></div>
          <div><span>ส่วนสูง</span><strong>${member.height} cm</strong></div>
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
    </div>
  `, "trainer-page");

  const toast = (message) => {
    const el = document.querySelector("#member-detail-toast");
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2400);
  };

  document.querySelector("#member-detail-back").addEventListener("click", () => navigate("/members"));
  document.querySelector("#edit-member").addEventListener("click", () => navigate(`/member-edit-${member.code}`));
  document.querySelector("#weekly-checkin-tab").addEventListener("click", () => navigate(`/weekly-checkins-${member.code}`));
  document.querySelector("#progress-tab").addEventListener("click", () => navigate(`/progress-${member.code}`));
  document.querySelector("#progress-photo-tab").addEventListener("click", () => navigate(`/progress-photos-${member.code}`));
  document.querySelector("#history-tab")?.addEventListener("click", () => toast("Workout History แบบเต็มจะมาใน Pack 05 Part 2"));
  document.querySelector("#package-tab")?.addEventListener("click", () => navigate(`/member-package-${member.code}`));
  document.querySelector("#manage-package")?.addEventListener("click", () => navigate(`/member-package-${member.code}`));
  document.querySelector("#view-history")?.addEventListener("click", () => toast("Workout History แบบเต็มจะมาใน Pack 05 Part 2"));
}

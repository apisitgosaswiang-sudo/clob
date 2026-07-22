import { navigate } from "./router.js";
import { loadMembers } from "./members.js";
import { backupMemberData, exportMemberData } from "./data-safety.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");
let members = [];

export async function renderBetaControlPage() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  members = await loadMembers();

  app.innerHTML = `
    <main class="page trainer-page">
      <div class="beta-control-screen">
        <header class="beta-control-head">
          <button id="beta-back" class="back-button">←</button>
          <div>
            <p class="section-label">PACK10</p>
            <h1>Beta Control</h1>
          </div>
        </header>

        <section class="freeze-banner">
          <strong>Feature Freeze Enabled</strong>
          <p>จากนี้ให้แก้เฉพาะ Bug, Security และ Data Integrity ก่อนจบช่วงทดลอง</p>
        </section>

        <section class="data-safety-card card">
          <h2>Data Safety Rules</h2>
          <div class="safety-rule"><span>1</span><p>ห้ามเปลี่ยนชื่อหรือลบ Firebase path เดิม</p></div>
          <div class="safety-rule"><span>2</span><p>ฟีเจอร์ใหม่ต้องใช้ path versioned เช่น <code>clob/v1</code></p></div>
          <div class="safety-rule"><span>3</span><p>สร้าง Backup ก่อนแก้โครงสร้างข้อมูลทุกครั้ง</p></div>
          <div class="safety-rule"><span>4</span><p>การเปลี่ยน schema ต้องเป็น additive เท่านั้น</p></div>
        </section>

        <section class="beta-member-backups">
          <div class="dashboard-section-head">
            <div>
              <p class="section-label">MEMBER DATA</p>
              <h2>Backup & Export</h2>
            </div>
          </div>

          <div class="backup-member-list">
            ${members.map(memberMarkup).join("")}
          </div>
        </section>

        <div id="beta-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  bind();
}

function memberMarkup(member) {
  return `
    <article class="backup-member-card card">
      <div>
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.code)}</span>
      </div>
      <div>
        <button data-backup-code="${escapeHtml(member.code)}">Backup</button>
        <button data-export-code="${escapeHtml(member.code)}">Export JSON</button>
      </div>
    </article>
  `;
}

function bind() {
  document.querySelector("#beta-back").addEventListener("click", () => navigate("/trainer-settings"));

  document.querySelectorAll("[data-backup-code]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Backing up...";
      try {
        const result = await backupMemberData(button.dataset.backupCode, "pre-beta-change");
        toast(result.backupId ? `Backup created: ${result.backupId}` : "Local backup created");
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
        button.textContent = "Backup";
      }
    });
  });

  document.querySelectorAll("[data-export-code]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await exportMemberData(button.dataset.exportCode);
        toast("Export downloaded");
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function toast(message) {
  const element = document.querySelector("#beta-toast");
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  setTimeout(() => { element.hidden = true; }, 2200);
}

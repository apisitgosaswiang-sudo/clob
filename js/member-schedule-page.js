import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import {
  loadPrograms,
  loadMemberProgram,
  addProgramToQueue,
  removeQueueItem,
  moveQueueItem,
  unassignProgram
} from "./programs.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberSchedulePage(code) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const [members, programs, assignment] = await Promise.all([
    loadMembers(),
    loadPrograms(),
    loadMemberProgram(code)
  ]);
  const member = getMemberByCode(members, code);
  if (!member) { navigate("/members"); return; }

  render(member, programs, assignment);
}

function render(member, programs, assignment) {
  const queue = assignment.queue || [];

  app.innerHTML = `<main class="page trainer-page"><div class="member-detail-screen">
    <header class="member-detail-header">
      <button id="schedule-back" class="back-button">←</button>
      <h1>จัดตารางเทรน</h1><span></span>
    </header>

    <section class="member-profile-card">
      <div class="member-profile-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</div>
      <div><h2>${escapeHtml(member.name)}</h2><small>${queue.length ? `${queue.length} โปรแกรมในคิว` : "ยังไม่มีโปรแกรมในคิว"}</small></div>
    </section>

    <section class="detail-card card">
      <div class="detail-card-title"><div><h3>คิวโปรแกรมฝึก</h3><p>${queue.length ? "ไล่ตามลำดับที่ทำสำเร็จ ทำครบแล้ววนกลับข้อแรก" : "ยังไม่ได้กำหนดโปรแกรม"}</p></div></div>

      ${queue.length ? `
        <ol class="program-queue-list">
          ${queue.map((item, index) => `
            <li class="program-queue-item">
              <span class="program-queue-index">${index + 1}</span>
              <span class="program-queue-name">${escapeHtml(item.programName || "Program")}</span>
              <span class="program-queue-actions">
                <button data-queue-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="ย้ายขึ้น">↑</button>
                <button data-queue-down="${index}" ${index === queue.length - 1 ? "disabled" : ""} aria-label="ย้ายลง">↓</button>
                <button data-queue-remove="${index}" aria-label="ลบออกจากคิว">×</button>
              </span>
            </li>
          `).join("")}
        </ol>
      ` : `<div class="members-empty card"><strong>ยังไม่มีโปรแกรมในคิว</strong><p>เพิ่มโปรแกรมด้านล่างเพื่อเริ่มจัดตารางเทรน</p></div>`}

      <label class="form-wide"><span>เพิ่มโปรแกรมเข้าคิว</span><select id="member-program-select">
        <option value="">เลือก Program</option>
        ${programs.filter((p) => p.status !== "archived").map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")}
      </select></label>

      <div class="member-program-actions">
        <button id="assign-member-program" class="button button-primary">+ เพิ่มเข้าคิว</button>
        ${queue.length ? `<button id="remove-member-program" class="button button-secondary">ล้างคิวทั้งหมด</button>` : ""}
      </div>
    </section>

    <div id="schedule-toast" class="toast" hidden></div>
  </div></main>`;

  document.querySelector("#schedule-back").onclick = () => navigate(`/member-detail-${member.code}`);
  bindActions(member, programs);
}

function bindActions(member, programs) {
  const toast = (message) => {
    const el = document.querySelector("#schedule-toast");
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2400);
  };

  const refresh = async () => {
    const assignment = await loadMemberProgram(member.code);
    render(member, programs, assignment);
  };

  document.querySelector("#assign-member-program")?.addEventListener("click", async () => {
    const program = programs.find((item) => item.id === document.querySelector("#member-program-select").value);
    if (!program) { toast("กรุณาเลือก Program"); return; }
    try { await addProgramToQueue(program, member.code, new Date().toISOString().slice(0, 10)); toast("เพิ่มเข้าคิวเรียบร้อย"); await refresh(); }
    catch (error) { toast(error.message || "เพิ่มเข้าคิวไม่สำเร็จ"); }
  });

  document.querySelector("#remove-member-program")?.addEventListener("click", async () => {
    if (!window.confirm(`ล้างคิวโปรแกรมทั้งหมดของ ${member.name} หรือไม่?`)) return;
    try { await unassignProgram(member.code); toast("ล้างคิวโปรแกรมแล้ว"); await refresh(); }
    catch (error) { toast(error.message || "ล้างคิวไม่สำเร็จ"); }
  });

  document.querySelectorAll("[data-queue-up]").forEach((button) => {
    button.addEventListener("click", async () => {
      try { await moveQueueItem(member.code, Number(button.dataset.queueUp), -1); await refresh(); }
      catch (error) { toast(error.message || "จัดลำดับไม่สำเร็จ"); }
    });
  });

  document.querySelectorAll("[data-queue-down]").forEach((button) => {
    button.addEventListener("click", async () => {
      try { await moveQueueItem(member.code, Number(button.dataset.queueDown), 1); await refresh(); }
      catch (error) { toast(error.message || "จัดลำดับไม่สำเร็จ"); }
    });
  });

  document.querySelectorAll("[data-queue-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.queueRemove);
      try {
        await removeQueueItem(member.code, index);
        toast("ลบออกจากคิวแล้ว");
        await refresh();
      } catch (error) {
        toast(error.message || "ลบออกจากคิวไม่สำเร็จ");
      }
    });
  });
}

import { navigate } from "./router.js";
import { loadMembers, getMemberByCode } from "./members.js";
import {
  loadPrograms,
  loadMemberProgram,
  addProgramToQueue,
  removeQueueItem,
  moveQueueItem,
  unassignProgram,
  addExtraToQueueItem,
  removeExtraFromQueueItem,
  getExerciseLibrary
} from "./programs.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");

export async function renderMemberSchedulePage(code) {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const [members, programs, assignment, exerciseLibrary] = await Promise.all([
    loadMembers(),
    loadPrograms(),
    loadMemberProgram(code),
    getExerciseLibrary()
  ]);
  const member = getMemberByCode(members, code);
  if (!member) { navigate("/members"); return; }

  render(member, programs, assignment, exerciseLibrary);
}

function render(member, programs, assignment, exerciseLibrary) {
  const queue = assignment.queue || [];

  app.innerHTML = `<main class="page trainer-page"><div class="member-detail-screen">
    <header class="member-detail-header">
      <button id="schedule-back" class="back-button">←</button>
      <h1>จัดตารางเทรน</h1><span></span>
    </header>

    <section class="member-profile-card">
      <div class="member-profile-avatar">${escapeHtml(member.name.charAt(0).toUpperCase())}</div>
      <div><h2>${escapeHtml(member.name)}</h2><small>${queue.length ? `${queue.length} วันในคิว` : "ยังไม่มีโปรแกรมในคิว"}</small></div>
    </section>

    <section class="detail-card card">
      <div class="detail-card-title"><div><h3>คิวโปรแกรมฝึก</h3><p>${queue.length ? "ไล่ตามลำดับที่ทำสำเร็จ Day 1 › Day 2 › ... ทำครบแล้ววนกลับ Day 1 ใหม่" : "ยังไม่ได้กำหนดโปรแกรม"}</p></div></div>

      ${queue.length ? `
        <ol class="program-queue-list">
          ${queue.map((item, index) => queueItemMarkup(item, index, queue.length, exerciseLibrary)).join("")}
        </ol>
      ` : `<div class="members-empty card"><strong>ยังไม่มีโปรแกรมในคิว</strong><p>เพิ่มโปรแกรมด้านล่างเพื่อเริ่มจัดตารางเทรน</p></div>`}

      <label class="form-wide"><span>เพิ่มโปรแกรมเข้าคิวเป็น Day ${queue.length + 1}</span><select id="member-program-select">
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
  bindActions(member, programs, exerciseLibrary);
}

function queueItemMarkup(item, index, queueLength, exerciseLibrary) {
  const extras = item.extras || [];
  return `
    <li class="program-queue-item-wrap">
      <div class="program-queue-item">
        <span class="program-queue-index">Day ${index + 1}</span>
        <span class="program-queue-name">${escapeHtml(item.programName || "Program")}</span>
        <span class="program-queue-actions">
          <button data-queue-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="ย้ายขึ้น">↑</button>
          <button data-queue-down="${index}" ${index === queueLength - 1 ? "disabled" : ""} aria-label="ย้ายลง">↓</button>
          <button data-queue-remove="${index}" aria-label="ลบออกจากคิว">×</button>
        </span>
      </div>
      ${extras.length ? `
        <ul class="queue-extras-list">
          ${extras.map((extra) => `
            <li>
              <span>${escapeHtml(extra.name)} · ${escapeHtml(String(extra.sets))}×${escapeHtml(String(extra.reps))}</span>
              <button data-remove-extra="${index}:${extra.id}" aria-label="ลบท่าพิเศษ">×</button>
            </li>
          `).join("")}
        </ul>
      ` : ""}
      <select class="queue-extra-select" data-extra-select="${index}">
        <option value="">+ เพิ่มท่าพิเศษสำหรับ Day ${index + 1} (แยกจากโปรแกรม)</option>
        ${exerciseLibrary.filter((ex) => ex.status !== "archived").map((ex) => `<option value="${escapeHtml(ex.id)}">${escapeHtml(ex.name)}</option>`).join("")}
      </select>
    </li>
  `;
}

function bindActions(member, programs, exerciseLibrary) {
  const toast = (message) => {
    const el = document.querySelector("#schedule-toast");
    el.textContent = message;
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2400);
  };

  const refresh = async () => {
    const assignment = await loadMemberProgram(member.code);
    render(member, programs, assignment, exerciseLibrary);
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

  document.querySelectorAll("[data-extra-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      const index = Number(select.dataset.extraSelect);
      const exercise = exerciseLibrary.find((item) => item.id === select.value);
      if (!exercise) return;
      try {
        await addExtraToQueueItem(member.code, index, { id: exercise.id, name: exercise.name, sets: 3, reps: "10" });
        toast(`เพิ่ม ${exercise.name} เป็นท่าพิเศษของ Day ${index + 1} แล้ว`);
        await refresh();
      } catch (error) {
        toast(error.message || "เพิ่มท่าพิเศษไม่สำเร็จ");
      }
    });
  });

  document.querySelectorAll("[data-remove-extra]").forEach((button) => {
    button.addEventListener("click", async () => {
      const [index, extraId] = button.dataset.removeExtra.split(":");
      try {
        await removeExtraFromQueueItem(member.code, Number(index), extraId);
        toast("ลบท่าพิเศษแล้ว");
        await refresh();
      } catch (error) {
        toast(error.message || "ลบท่าพิเศษไม่สำเร็จ");
      }
    });
  });
}

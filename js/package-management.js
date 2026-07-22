import { navigate } from "./router.js";
import { getPackages, savePackageRecord } from "./firebase.js";
import { escapeHtml } from "./utils.js";

const app = document.querySelector("#app");

export const DEFAULT_PACKAGE_CATALOG = [
  {
    id: "monthly-basic",
    name: "Online Coaching Basic",
    price: 1990,
    months: 1,
    billingCycle: "monthly",
    renewal: "manual",
    status: "active",
    features: ["โปรแกรมฝึก", "Weekly Check-in", "Habit Tracking", "Coach Review"]
  },
  {
    id: "monthly-standard",
    name: "Online Coaching Standard",
    price: 2990,
    months: 1,
    billingCycle: "monthly",
    renewal: "auto",
    status: "active",
    features: ["โปรแกรมฝึก", "Weekly Check-in", "Habit Tracking", "Coach Review"]
  },
  {
    id: "quarterly",
    name: "Online Coaching 3 Months",
    price: 7990,
    months: 3,
    billingCycle: "quarterly",
    renewal: "manual",
    status: "active",
    features: ["โปรแกรมฝึก", "Weekly Check-in", "Habit Tracking", "Coach Review"]
  }
];

function normalizePackage(id, value = {}) {
  const features = Array.isArray(value.features)
    ? value.features.filter(Boolean)
    : Object.entries(value.features || {}).filter(([, enabled]) => enabled).map(([name]) => name);

  return {
    id,
    name: String(value.name || "Untitled Package"),
    price: Number(value.price || 0),
    months: Math.max(1, Number(value.months || 1)),
    billingCycle: value.billingCycle || (Number(value.months) === 3 ? "quarterly" : "monthly"),
    renewal: value.renewal || "manual",
    status: ["active", "hidden", "archived"].includes(value.status) ? value.status : "active",
    features,
    updatedAt: Number(value.updatedAt || 0)
  };
}

export async function loadPackageCatalog({ includeInactive = true } = {}) {
  const remote = await getPackages();
  const merged = new Map(DEFAULT_PACKAGE_CATALOG.map((item) => [item.id, normalizePackage(item.id, item)]));
  Object.entries(remote || {}).forEach(([id, value]) => merged.set(id, normalizePackage(id, value)));
  const list = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  return includeInactive ? list : list.filter((item) => item.status === "active");
}

function packageIdFromName(name) {
  const slug = String(name || "package")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "package";
  return `${slug}-${Date.now().toString(36)}`;
}

function statusLabel(status) {
  if (status === "hidden") return "Hidden";
  if (status === "archived") return "Archived";
  return "Active";
}

export async function renderPackageManagement() {
  if (sessionStorage.getItem("clob_trainer") !== "true") {
    navigate("/trainer-login");
    return;
  }

  const packages = await loadPackageCatalog();
  app.innerHTML = `
    <main class="page trainer-page">
      <div class="package-management-screen">
        <header class="package-management-header">
          <button id="packages-back" class="back-button" aria-label="ย้อนกลับ">←</button>
          <div>
            <p class="section-label">SETTINGS</p>
            <h1>Packages</h1>
          </div>
          <button id="add-package" class="compact-action" type="button">+ เพิ่ม</button>
        </header>

        <p class="package-management-help">จัดการแพ็กเกจที่ใช้เลือกให้สมาชิก ปุ่มถูกออกแบบให้ไม่เด่นเกินไปเพราะไม่ได้ใช้งานบ่อย</p>

        <section class="package-list" aria-label="รายการแพ็กเกจ">
          ${packages.map((pkg) => `
            <article class="package-list-item card">
              <div class="package-list-copy">
                <div class="package-list-title-row">
                  <strong>${escapeHtml(pkg.name)}</strong>
                  <span class="package-status package-status-${pkg.status}">${statusLabel(pkg.status)}</span>
                </div>
                <span>฿${pkg.price.toLocaleString()} · ${pkg.months} เดือน</span>
                ${pkg.features.length ? `<small>${pkg.features.map(escapeHtml).join(" · ")}</small>` : ""}
              </div>
              <button class="icon-action" data-edit-package="${escapeHtml(pkg.id)}" type="button" aria-label="แก้ไข ${escapeHtml(pkg.name)}">✎</button>
            </article>
          `).join("")}
        </section>

        <div id="package-editor-host"></div>
        <div id="package-toast" class="toast" hidden></div>
      </div>
    </main>
  `;

  document.querySelector("#packages-back")?.addEventListener("click", () => navigate("/trainer-settings"));
  document.querySelector("#add-package")?.addEventListener("click", () => renderEditor(null));
  document.querySelectorAll("[data-edit-package]").forEach((button) => {
    button.addEventListener("click", () => {
      const pkg = packages.find((item) => item.id === button.dataset.editPackage);
      renderEditor(pkg || null);
    });
  });
}

function renderEditor(pkg) {
  const host = document.querySelector("#package-editor-host");
  if (!host) return;
  const editing = Boolean(pkg);
  host.innerHTML = `
    <div class="package-editor-backdrop" id="package-editor-backdrop">
      <section class="package-editor card" role="dialog" aria-modal="true" aria-labelledby="package-editor-title">
        <header>
          <div>
            <p class="section-label">${editing ? "EDIT" : "NEW"}</p>
            <h2 id="package-editor-title">${editing ? "แก้ไขแพ็กเกจ" : "เพิ่มแพ็กเกจ"}</h2>
          </div>
          <button id="close-package-editor" class="icon-action" type="button" aria-label="ปิด">×</button>
        </header>
        <form id="package-editor-form">
          <label><span>ชื่อแพ็กเกจ</span><input name="name" required maxlength="80" value="${escapeHtml(pkg?.name || "")}"></label>
          <div class="package-editor-grid">
            <label><span>ราคา (บาท)</span><input name="price" type="number" min="0" step="1" value="${pkg?.price ?? 0}"></label>
            <label><span>ระยะเวลา (เดือน)</span><input name="months" type="number" min="1" max="36" value="${pkg?.months ?? 1}"></label>
            <label><span>รอบบิล</span><select name="billingCycle"><option value="monthly" ${pkg?.billingCycle !== "quarterly" ? "selected" : ""}>Monthly</option><option value="quarterly" ${pkg?.billingCycle === "quarterly" ? "selected" : ""}>Quarterly</option></select></label>
            <label><span>การต่ออายุ</span><select name="renewal"><option value="manual" ${pkg?.renewal !== "auto" ? "selected" : ""}>Manual</option><option value="auto" ${pkg?.renewal === "auto" ? "selected" : ""}>Auto</option></select></label>
            <label><span>สถานะ</span><select name="status"><option value="active" ${pkg?.status === "active" || !pkg ? "selected" : ""}>Active</option><option value="hidden" ${pkg?.status === "hidden" ? "selected" : ""}>Hidden</option><option value="archived" ${pkg?.status === "archived" ? "selected" : ""}>Archived</option></select></label>
          </div>
          <label><span>สิทธิ์ในแพ็กเกจ (หนึ่งรายการต่อบรรทัด)</span><textarea name="features" rows="5" placeholder="โปรแกรมฝึก&#10;Weekly Check-in">${escapeHtml((pkg?.features || []).join("\n"))}</textarea></label>
          <div class="package-editor-actions">
            <button id="cancel-package-editor" class="button button-text compact-button" type="button">ยกเลิก</button>
            <button class="button button-primary compact-button" type="submit">บันทึก</button>
          </div>
        </form>
      </section>
    </div>
  `;

  const close = () => { host.innerHTML = ""; };
  document.querySelector("#close-package-editor")?.addEventListener("click", close);
  document.querySelector("#cancel-package-editor")?.addEventListener("click", close);
  document.querySelector("#package-editor-backdrop")?.addEventListener("click", (event) => {
    if (event.target.id === "package-editor-backdrop") close();
  });

  document.querySelector("#package-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const id = pkg?.id || packageIdFromName(name);
    button.disabled = true;
    button.textContent = "กำลังบันทึก...";

    const saved = await savePackageRecord(id, {
      name,
      price: Number(data.get("price") || 0),
      months: Math.max(1, Number(data.get("months") || 1)),
      billingCycle: data.get("billingCycle"),
      renewal: data.get("renewal"),
      status: data.get("status"),
      features: String(data.get("features") || "").split("\n").map((item) => item.trim()).filter(Boolean),
      updatedAt: Date.now()
    });

    if (!saved) {
      button.disabled = false;
      button.textContent = "บันทึก";
      showPackageToast("บันทึก Firebase ไม่สำเร็จ");
      return;
    }

    close();
    showPackageToast("บันทึกแพ็กเกจแล้ว");
    setTimeout(() => renderPackageManagement(), 350);
  });
}

function showPackageToast(message) {
  const toast = document.querySelector("#package-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 1800);
}

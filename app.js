
const app = document.getElementById("app");
const shell = document.getElementById("shell");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const eyebrow = document.getElementById("pageEyebrow");
const toast = document.getElementById("toast");
const modalBackdrop = document.getElementById("modalBackdrop");
const form = document.getElementById("clientForm");
const navItems = [...document.querySelectorAll(".nav-item")];

let currentPage = "home";
let data = { clients:{}, exercises:{}, favorites:{}, recent:{} };
let selectedCategory = "All";
let exerciseQuery = "";
let clientQuery = "";

function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove("show"),1800)}
function values(obj){return Object.entries(obj||{}).map(([id,v])=>({id,...v}))}
function formatDate(v){if(!v)return "ยังไม่กำหนด";return new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",year:"2-digit"}).format(new Date(v+"T12:00:00"))}

function clientCard(c){
  return `<article class="list-card">
    <div class="avatar">${escapeHtml((c.name||"?").slice(0,1))}</div>
    <button class="content" data-edit-client="${c.id}" style="border:0;background:none;text-align:left;padding:0;color:inherit">
      <strong>${escapeHtml(c.name)}</strong>
      <small>${escapeHtml(c.goal||"ยังไม่ได้ระบุเป้าหมาย")} • หมดอายุ ${formatDate(c.packageExpiry)}</small>
    </button>
    <button class="danger-btn" data-delete-client="${c.id}">ลบ</button>
  </article>`
}

function homePage(){
  const clients=values(data.clients);
  const expiring=clients.filter(c=>c.packageExpiry && new Date(c.packageExpiry) >= new Date() && new Date(c.packageExpiry) <= new Date(Date.now()+30*864e5)).length;
  return `<section class="hero"><h1>สวัสดีครับ Coach 👋</h1><p>CLOB เชื่อมต่อ Firebase แล้ว ข้อมูลจะบันทึกอัตโนมัติ</p></section>
  <section class="section"><div class="summary-grid">
    <article class="summary-card"><div class="dot"></div><strong>${clients.length}</strong><small>Clients</small></article>
    <article class="summary-card"><div class="dot"></div><strong>${Object.keys(data.exercises).length}</strong><small>Exercises</small></article>
    <article class="summary-card"><div class="dot"></div><strong>${expiring}</strong><small>ใกล้หมดอายุ</small></article>
  </div></section>
  <section class="section"><button class="primary-action" id="quickAddClient"><span>เพิ่มลูกค้าใหม่</span><span>＋</span></button></section>
  <section class="section"><div class="section-head"><h2>ลูกค้าล่าสุด</h2><button class="text-btn" data-jump="clients">ดูทั้งหมด</button></div>
  <div class="list">${clients.slice(-3).reverse().map(clientCard).join("")||'<div class="empty-card"><h3>ยังไม่มีลูกค้า</h3><p>เพิ่มลูกค้าคนแรกเพื่อเริ่มใช้งาน</p></div>'}</div></section>`;
}

function clientsPage(){
  const q=clientQuery.toLowerCase();
  const clients=values(data.clients).filter(c=>(c.name+" "+(c.phone||"")+" "+(c.goal||"")).toLowerCase().includes(q));
  return `<div class="page-title"><h1>Clients</h1><p>แพ็กเกจใช้วันเริ่มต้น จำนวนเดือน และวันหมดอายุ</p></div>
  <div class="search"><span>⌕</span><input id="clientSearch" placeholder="ค้นหาลูกค้า" value="${escapeHtml(clientQuery)}"></div>
  <section class="section"><div class="section-head"><h2>ลูกค้าทั้งหมด</h2><button class="text-btn" id="addClient">＋ เพิ่ม</button></div>
  <div class="list">${clients.map(clientCard).join("")||'<div class="empty-card"><h3>ไม่พบลูกค้า</h3><p>ลองเปลี่ยนคำค้นหา</p></div>'}</div></section>`;
}

function programsPage(){
  return `<div class="page-title"><h1>Programs</h1><p>Program Builder จะพัฒนาใน Alpha 0.2</p></div>
  <div class="empty-card"><h3>Foundation พร้อมแล้ว</h3><p>รอบถัดไปจะเพิ่ม Weeks → Days → Exercises และ Exercise Picker</p></div>`;
}

function exerciseCard(e){
  const fav=!!data.favorites[e.id];
  return `<article class="exercise-card">
    <div class="exercise-icon">${escapeHtml((e.movementPattern||"EX").slice(0,2).toUpperCase())}</div>
    <button class="content" data-use-exercise="${e.id}" style="border:0;background:none;text-align:left;padding:0;color:inherit">
      <strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.category)} • ${escapeHtml(e.equipment)} • ${escapeHtml(e.difficulty)}</small>
    </button>
    <button class="fav-btn ${fav?"active":""}" data-fav="${e.id}" aria-label="favorite">${fav?"★":"☆"}</button>
  </article>`;
}

function exercisesPage(){
  const exercises=values(data.exercises);
  const q=exerciseQuery.toLowerCase();
  const filtered=exercises.filter(e=>(selectedCategory==="All"||e.category===selectedCategory)&&
    (e.name+" "+e.equipment+" "+e.primaryMuscle+" "+e.movementPattern).toLowerCase().includes(q));
  const recentIds=Object.entries(data.recent||{}).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id])=>id);
  const recent=recentIds.map(id=>data.exercises[id]&&({id,...data.exercises[id]})).filter(Boolean);
  return `<div class="page-title"><h1>Exercises</h1><p>${exercises.length} ท่า • Search, Favorites และ Recent พร้อมใช้</p></div>
  <div class="search"><span>⌕</span><input id="exerciseSearch" placeholder="ค้นหาท่า อุปกรณ์ หรือกล้ามเนื้อ" value="${escapeHtml(exerciseQuery)}"></div>
  <div class="chips">${["All","Legs","Push","Pull","Core","Cardio","Accessory","Mobility"].map(c=>`<button class="chip ${selectedCategory===c?"active":""}" data-cat="${c}">${c}</button>`).join("")}</div>
  ${recent.length&&!exerciseQuery&&selectedCategory==="All"?`<section class="section"><div class="section-head"><h2>Recent</h2></div><div>${recent.map(exerciseCard).join("")}</div></section>`:""}
  <section class="section" style="margin-top:14px"><div class="section-head"><h2>Exercise Library</h2><button class="text-btn" id="showFavorites">Favorites</button></div>
  <div>${filtered.map(exerciseCard).join("")||'<div class="empty-card"><h3>ไม่พบท่า</h3><p>ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p></div>'}</div></section>`;
}

function settingsPage(){
  return `<div class="page-title"><h1>Settings</h1><p>CLOB Alpha 0.1</p></div>
  <div class="settings-card"><strong>Anonymous User ID</strong><br><code>${escapeHtml(ClobDB.getUid()||"")}</code></div>
  <section class="section"><div class="settings-card"><strong>Database path</strong><p style="color:var(--muted)">clob/users/{uid} และ clob/exercise_master</p></div></section>`;
}

const pages={home:homePage,clients:clientsPage,programs:programsPage,exercises:exercisesPage,settings:settingsPage};

function render(){
  app.innerHTML=pages[currentPage]();
  navItems.forEach(n=>n.classList.toggle("active",n.dataset.page===currentPage));
  bindEvents();
}
function setPage(page){currentPage=page;eyebrow.textContent={home:"Coach workspace",clients:"จัดการลูกค้า",programs:"โปรแกรมฝึก",exercises:"คลังท่าออกกำลังกาย",settings:"การตั้งค่า"}[page];window.scrollTo({top:0,behavior:"instant"});render()}

function openClientModal(client=null){
  document.getElementById("modalTitle").textContent=client?"แก้ไขลูกค้า":"เพิ่มลูกค้า";
  document.getElementById("clientId").value=client?.id||"";
  document.getElementById("clientName").value=client?.name||"";
  document.getElementById("clientPhone").value=client?.phone||"";
  document.getElementById("clientGoal").value=client?.goal||"";
  document.getElementById("packageStart").value=client?.packageStart||new Date().toISOString().slice(0,10);
  document.getElementById("packageMonths").value=client?.packageMonths||1;
  modalBackdrop.hidden=false;document.body.style.overflow="hidden";
}
function closeClientModal(){modalBackdrop.hidden=true;document.body.style.overflow=""}

function bindEvents(){
  document.getElementById("quickAddClient")?.addEventListener("click",()=>openClientModal());
  document.getElementById("addClient")?.addEventListener("click",()=>openClientModal());
  document.getElementById("clientSearch")?.addEventListener("input",e=>{clientQuery=e.target.value;render()});
  document.querySelectorAll("[data-jump]").forEach(el=>el.addEventListener("click",()=>setPage(el.dataset.jump)));
  document.querySelectorAll("[data-edit-client]").forEach(el=>el.addEventListener("click",()=>{const id=el.dataset.editClient;openClientModal({id,...data.clients[id]})}));
  document.querySelectorAll("[data-delete-client]").forEach(el=>el.addEventListener("click",async()=>{if(confirm("ลบลูกค้ารายนี้หรือไม่?")){await ClobDB.deleteClient(el.dataset.deleteClient);showToast("ลบลูกค้าแล้ว")}}));
  document.getElementById("exerciseSearch")?.addEventListener("input",e=>{exerciseQuery=e.target.value;render()});
  document.querySelectorAll("[data-cat]").forEach(el=>el.addEventListener("click",()=>{selectedCategory=el.dataset.cat;render()}));
  document.querySelectorAll("[data-fav]").forEach(el=>el.addEventListener("click",async()=>{await ClobDB.toggleFavorite(el.dataset.fav)}));
  document.querySelectorAll("[data-use-exercise]").forEach(el=>el.addEventListener("click",async()=>{await ClobDB.markRecent(el.dataset.useExercise);showToast("เพิ่มใน Recent แล้ว")}));
  document.getElementById("showFavorites")?.addEventListener("click",()=>{const favIds=Object.keys(data.favorites||{});exerciseQuery="";selectedCategory="All";const all=data.exercises;data.exercises=Object.fromEntries(favIds.filter(id=>all[id]).map(id=>[id,all[id]]));render();setTimeout(()=>location.reload(),3000)});
}

navItems.forEach(n=>n.addEventListener("click",()=>setPage(n.dataset.page)));
document.getElementById("closeModal").addEventListener("click",closeClientModal);
document.getElementById("cancelModal").addEventListener("click",closeClientModal);
modalBackdrop.addEventListener("click",e=>{if(e.target===modalBackdrop)closeClientModal()});
form.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    await ClobDB.saveClient({
      id:document.getElementById("clientId").value,
      name:document.getElementById("clientName").value,
      phone:document.getElementById("clientPhone").value,
      goal:document.getElementById("clientGoal").value,
      packageStart:document.getElementById("packageStart").value,
      packageMonths:document.getElementById("packageMonths").value
    });
    closeClientModal();showToast("บันทึกลูกค้าแล้ว");
  }catch(err){alert(err.message)}
});

(async()=>{
  try{
    const result=await ClobDB.init();
    loadingText.textContent=result.seeded?"นำเข้าฐานข้อมูล 192 ท่าเรียบร้อย":"เชื่อมต่อเรียบร้อย";
    ClobDB.subscribeAll((key,value)=>{data[key]=value;render()});
    setTimeout(()=>{loading.hidden=true;shell.hidden=false;render()},500);
  }catch(err){
    loadingText.textContent="เชื่อมต่อไม่สำเร็จ: "+err.message;
    console.error(err);
  }
})();

import { auth, dataRef, get, set, signInAnonymously } from "./firebase.js";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
let toastTimer=null;
function showToast(message="บันทึกเรียบร้อยแล้ว"){
  const t=$("#toast");
  if(!t)return;
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),1800);
}
function scrollPageTop(behavior="smooth"){
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior}));
}
function renderFromTop(){
  render();
  scrollPageTop();
}
const today=()=>{const d=new Date();return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()+543}`};

const isoToday=()=>{
  const d=new Date();
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
};
function parseThaiOrISODate(value){
  const text=String(value||"").trim();
  if(!text)return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(text)){
    const [y,m,d]=text.split("-").map(Number);
    return new Date(y,m-1,d);
  }
  const parts=text.split("/");
  if(parts.length===3){
    let [d,m,y]=parts.map(Number);
    if(y>2500)y-=543;
    const date=new Date(y,m-1,d);
    return Number.isNaN(date.getTime())?null:date;
  }
  const date=new Date(text);
  return Number.isNaN(date.getTime())?null:date;
}
function dateToISO(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime()))return "";
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}
function formatThaiDate(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime()))return "-";
  return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()+543}`;
}
function addMonthsSafe(start,months){
  const date=new Date(start.getFullYear(),start.getMonth(),start.getDate());
  const originalDay=date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth()+Number(months||0));
  const lastDay=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  date.setDate(Math.min(originalDay,lastDay));
  return date;
}
function packageInfo(customer){
  const months=Math.max(0,Number(customer?.subscriptionMonths||0));
  const start=parseThaiOrISODate(customer?.startDateISO||customer?.startDate);
  if(!months||!start){
    return {
      configured:false,
      months:months||0,
      start,
      end:null,
      daysLeft:null,
      status:"unset",
      label:"ยังไม่กำหนดแพ็กเกจ",
      className:"package-unset"
    };
  }
  const end=addMonthsSafe(start,months);
  const now=new Date();
  now.setHours(0,0,0,0);
  end.setHours(23,59,59,999);
  const daysLeft=Math.max(0,Math.ceil((end-now)/86400000));
  const expired=end<now;
  const soon=!expired&&daysLeft<=14;
  return {
    configured:true,
    months,
    start,
    end,
    daysLeft:expired?0:daysLeft,
    status:expired?"expired":soon?"soon":"active",
    label:expired?"หมดอายุแล้ว":soon?`เหลือ ${daysLeft} วัน`:`เหลือ ${daysLeft} วัน`,
    className:expired?"package-expired":soon?"package-soon":"package-active"
  };
}
function packageBadge(customer){
  const p=packageInfo(customer);
  return `<span class="package-badge ${p.className}">${p.status==="expired"?"⛔":p.status==="soon"?"⏳":p.status==="active"?"●":"—"} ${esc(p.label)}</span>`;
}

const emptyData=()=>({customers:[],programs:{},logs:{},catalog:{categories:[]},bodyStats:{},programTemplates:[]});
let saveTimer=null,ready=false;
let S={data:null,role:null,screen:"customers",dashboardMode:true,customerId:null,activeDayId:null,customerTab:"today",programTab:"overview",entries:{},showAdd:false,lastCode:null};

function asArray(value){
  if(Array.isArray(value))return value.filter(Boolean);
  if(value && typeof value==="object")return Object.values(value).filter(Boolean);
  return [];
}

function normalize(raw){
  const source=raw&&typeof raw==="object"?raw:{};
  const d={...emptyData(),...source};

  d.customers=asArray(d.customers);
  d.programs=d.programs&&typeof d.programs==="object"?d.programs:{};
  d.logs=d.logs&&typeof d.logs==="object"?d.logs:{};
  d.bodyStats=d.bodyStats&&typeof d.bodyStats==="object"?d.bodyStats:{};
  d.programTemplates=asArray(d.programTemplates).map((t,i)=>({
    ...t,id:String(t?.id??uid()),name:String(t?.name??`โปรแกรม ${i+1}`),
    description:String(t?.description??""),category:String(t?.category??"General"),
    exercises:asArray(t?.exercises).map(ex=>({
      ...ex,id:String(ex?.id??uid()),name:String(ex?.name??""),
      catalogId:ex?.catalogId==null?null:String(ex.catalogId),
      sets:String(ex?.sets??"3"),reps:String(ex?.reps??"10"),
      weight:String(ex?.weight??""),restMinutes:String(ex?.restMinutes??""),
      notes:String(ex?.notes??"")
    }))
  }));

  const catalogSource=d.catalog&&typeof d.catalog==="object"?d.catalog:{};
  d.catalog={categories:asArray(catalogSource.categories).map(cat=>({
    ...cat,
    id:String(cat?.id??uid()),
    name:String(cat?.name??"หมวดหมู่"),
    exercises:asArray(cat?.exercises).map(ex=>({
      ...ex,
      id:String(ex?.id??uid()),
      name:String(ex?.name??""),
      videoUrl:String(ex?.videoUrl??"")
    }))
  }))};

  const used=d.customers.map(x=>String(x?.code??"").trim()).filter(Boolean);

  d.customers=d.customers.map(customer=>{
    const c={...customer};
    c.id=String(c.id??uid());
    c.name=String(c.name??"สมาชิก");
    c.code=String(c.code??"").trim();

    if(!c.code){
      let code;
      do{code=String(Math.floor(10000+Math.random()*90000))}
      while(used.includes(code));
      c.code=code;
      used.push(code);
    }

    if(!c.startDate)c.startDate=today();
    if(!c.startDateISO){
      const parsedStart=parseThaiOrISODate(c.startDate);
      c.startDateISO=parsedStart?dateToISO(parsedStart):isoToday();
    }
    c.subscriptionMonths=Math.max(0,Number(c.subscriptionMonths||0));

    const rawProgram=d.programs[c.id];
    const programSource=Array.isArray(rawProgram)
      ? {days:rawProgram}
      : (rawProgram&&typeof rawProgram==="object"?rawProgram:{});

    d.programs[c.id]={
      ...programSource,
      days:asArray(programSource.days).map((day,index)=>({
        ...day,
        id:String(day?.id??uid()),
        name:String(day?.name??`วันที่ ${index+1}`),
        exercises:asArray(day?.exercises).map(ex=>({
          ...ex,
          id:String(ex?.id??uid()),
          name:String(ex?.name??""),
          catalogId:ex?.catalogId==null?null:String(ex.catalogId),
          sets:String(ex?.sets??"3"),
          reps:String(ex?.reps??"10"),
          weight:String(ex?.weight??""),
          restMinutes:String(ex?.restMinutes??""),
          notes:String(ex?.notes??"")
        }))
      }))
    };

    d.logs[c.id]=asArray(d.logs[c.id]).map(log=>({
      ...log,
      id:String(log?.id??uid()),
      date:String(log?.date??""),
      dayId:log?.dayId==null?"":String(log.dayId),
      dayName:String(log?.dayName??"Workout"),
      entries:asArray(log?.entries).map(entry=>({
        ...entry,
        exerciseId:entry?.exerciseId==null?"":String(entry.exerciseId),
        name:String(entry?.name??"ท่าออกกำลังกาย"),
        actualSets:String(entry?.actualSets??""),
        actualReps:String(entry?.actualReps??""),
        weight:String(entry?.weight??""),
        completed:Boolean(entry?.completed)
      }))
    }));

    d.bodyStats[c.id]=asArray(d.bodyStats[c.id]).map(stat=>({
      ...stat,
      id:String(stat?.id??uid()),
      date:String(stat?.date??""),
      weight:String(stat?.weight??""),
      muscleMass:String(stat?.muscleMass??""),
      bodyFat:String(stat?.bodyFat??""),
      mood:String(stat?.mood??"")
    }));

    return c;
  });

  return d;
}

function showLoading(text="กำลังโหลดข้อมูล..."){
  $("#app").innerHTML=`<div class="loader"><span class="dot"></span><span>${esc(text)}</span></div>`;
}
function showError(e){
  console.error(e);
  const msg=e?.code==="auth/operation-not-allowed"?"กรุณาเปิด Anonymous Authentication ใน Firebase":"เชื่อมต่อ Firebase ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและ Firebase Rules";
  $("#app").innerHTML=`<div class="card"><h3 class="error">เชื่อมต่อระบบไม่สำเร็จ</h3><p class="small">${esc(msg)}</p><button class="btn btn-primary" onclick="location.reload()">ลองใหม่</button></div>`;
}
async function init(){
  showLoading("กำลังเชื่อมต่อ Firebase...");
  try{
    await signInAnonymously(auth);
    const snap=await get(dataRef);
    S.data=normalize(snap.exists()?snap.val():emptyData());
    ready=true;
    if(!snap.exists())await set(dataRef,S.data);
    render();
  }catch(e){showError(e)}
}
function save(){
  if(!ready)return;
  $("#saving").style.display="inline";
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{await set(dataRef,S.data);showToast()}
    catch(e){console.error(e);alert("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่")}
    finally{$("#saving").style.display="none"}
  },450);
}
function logout(){
  S={...S,role:null,screen:"customers",dashboardMode:true,customerId:null,activeDayId:null,customerTab:"today",programTab:"overview",entries:{},showAdd:false,lastCode:null};
  render();
}
function updateHeader(){
  $("#trainerBtn").hidden=!!S.role;
  $("#logoutBtn").hidden=!S.role;
}
function render(){
  updateHeader();
  try{
    if(!S.role)return renderLogin();
    if(S.role==="trainer"){
      if(S.screen==="catalog")return renderCatalog();
      if(S.screen==="templates")return renderTemplates();
      if(S.screen==="program")return renderProgram();
      if(S.dashboardMode)return renderTrainerDashboard();
      return renderCustomers();
    }
    return renderCustomer();
  }catch(error){
    console.error("Render error:",error);
    S.role=null;
    S.customerId=null;
    S.activeDayId=null;
    updateHeader();
    $("#app").innerHTML=`
      <div class="card">
        <h3 class="error">เปิดข้อมูลสมาชิกไม่สำเร็จ</h3>
        <p class="small">ข้อมูลเดิมบางส่วนยังไม่ครบ ระบบได้ป้องกันหน้าเว็บค้างแล้ว กรุณากดโหลดข้อมูลใหม่</p>
        <button class="btn btn-primary btn-block" id="repairReload">โหลดข้อมูลใหม่</button>
      </div>`;
    const button=$("#repairReload");
    if(button)button.onclick=()=>location.reload();
  }
}
function nav(active){
  return `<div class="nav">
    <button data-nav="dashboard" class="${active==="dashboard"?"active":""}">Dashboard</button>
    <button data-nav="customers" class="${active==="customers"?"active":""}">ลูกเทรน</button>
    <button data-nav="templates" class="${active==="templates"?"active":""}">Program Sets</button>
    <button data-nav="catalog" class="${active==="catalog"?"active":""}">Exercise Library</button>
  </div>`;
}
function bindNav(){
  $$("[data-nav]").forEach(b=>b.onclick=()=>{
    if(b.dataset.nav==="dashboard"){
      S.screen="customers";
      S.dashboardMode=true;
    }else{
      S.screen=b.dataset.nav;
      S.dashboardMode=false;
    }
    renderFromTop();
  });
}

function renderLogin(){
  $("#app").innerHTML=`
    <h1>เข้าสู่ระบบ</h1>
    <p class="muted">กรอกรหัสสมาชิก 5 หลักที่เทรนเนอร์ให้ไว้</p>
    <div class="card" style="max-width:380px">
      <div class="row">
        <input class="input" id="memberCode" maxlength="5" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" placeholder="รหัสสมาชิก 5 หลัก">
        <button class="btn btn-primary" id="memberLogin">เข้าสู่ระบบ</button>
      </div>
      <p id="memberError" class="small error" hidden>ไม่พบรหัสสมาชิกนี้</p>
    </div>`;
  const login=()=>{
    const code=$("#memberCode").value.trim();
    const c=S.data.customers.find(x=>String(x.code??"").trim()===code);
    if(!c)return $("#memberError").hidden=false;
    const program=S.data.programs[String(c.id)]||{days:[]};
    S.role="customer";
    S.customerId=String(c.id);
    S.activeDayId=asArray(program.days)[0]?.id??null;
    render();
  };
  $("#memberLogin").onclick=login;
  $("#memberCode").oninput=e=>{
    e.target.value=e.target.value.replace(/\D/g,"").slice(0,5);
    $("#memberError").hidden=true;
  };
  $("#memberCode").onkeydown=e=>{if(e.key==="Enter")login()};
}

function customerCard(c){
  const days=asArray(S.data.programs[c.id]?.days).length;
  const logs=asArray(S.data.logs[c.id]).length;
  const pkg=packageInfo(c);
  const packageMeta=pkg.configured
    ? `${pkg.months} เดือน · สิ้นสุด ${formatThaiDate(pkg.end)}`
    : "ยังไม่กำหนดระยะเวลา";
  return `<button class="customer" data-customer="${c.id}">
    <span class="row" style="min-width:0">
      <span class="avatar">${esc((c.name||"").slice(0,2))}</span>
      <span style="min-width:0">
        <span class="customer-summary-line">
          <b>${esc(c.name)}</b>
          ${packageBadge(c)}
        </span>
        <span class="small" style="display:block">รหัส ${esc(c.code)} · ${days} วันฝึก · บันทึก ${logs} ครั้ง</span>
        <span class="package-meta">${esc(packageMeta)}</span>
      </span>
    </span>
    <span>›</span>
  </button>`;
}

function countThisWeekLogs(logs){
  const now=new Date();
  const start=new Date(now);
  const day=(now.getDay()+6)%7;
  start.setHours(0,0,0,0);
  start.setDate(now.getDate()-day);

  return asArray(logs).filter(log=>{
    const parts=String(log?.date||"").split("/");
    if(parts.length!==3)return false;
    const year=Number(parts[2])>2500?Number(parts[2])-543:Number(parts[2]);
    const date=new Date(year,Number(parts[1])-1,Number(parts[0]));
    return date>=start&&date<=now;
  }).length;
}

function trainerDashboardData(){
  const customers=asArray(S.data.customers);
  const totalCustomers=customers.length;
  const totalPrograms=customers.reduce((sum,c)=>sum+asArray(S.data.programs?.[c.id]?.days).length,0);
  const totalLogs=customers.reduce((sum,c)=>sum+asArray(S.data.logs?.[c.id]).length,0);
  const weeklyLogs=customers.reduce((sum,c)=>sum+countThisWeekLogs(S.data.logs?.[c.id]),0);
  const expiringSoon=customers.filter(c=>packageInfo(c).status==="soon").length;
  const expired=customers.filter(c=>packageInfo(c).status==="expired").length;
  const activePackages=customers.filter(c=>packageInfo(c).status==="active").length;
  return {totalCustomers,totalPrograms,totalLogs,weeklyLogs,expiringSoon,expired,activePackages};
}

function renderTrainerDashboard(){
  const d=trainerDashboardData();
  const recent=asArray(S.data.customers).slice(-3).reverse();

  $("#app").innerHTML=`
    ${nav("dashboard")}
    <section class="hero-dashboard">
      <div class="hero-eyebrow">⚡ Trainer Command Center</div>
      <h1 class="hero-title">ภาพรวมการดูแลลูกเทรนของคุณ</h1>
      <p class="hero-subtitle">ติดตามโปรแกรม ความสม่ำเสมอ และความคืบหน้าได้จากหน้าเดียว</p>
      <div class="hero-actions">
        <button class="btn btn-primary" id="dashAddCustomer">＋ เพิ่มลูกเทรน</button>
        <button class="btn" id="dashOpenLibrary">🏋️ Exercise Library</button>
      </div>
    </section>

    <div class="dashboard-grid">
      <div class="metric-card">
        <div class="metric-icon">👥</div>
        <div class="metric-label">ลูกเทรนทั้งหมด</div>
        <div class="metric-value">${d.totalCustomers}</div>
        <div class="metric-note">โปรไฟล์ที่กำลังดูแล</div>
      </div>
      <div class="metric-card mint">
        <div class="metric-icon">✅</div>
        <div class="metric-label">Workout สัปดาห์นี้</div>
        <div class="metric-value">${d.weeklyLogs}</div>
        <div class="metric-note">รายการที่บันทึกแล้ว</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-icon">📋</div>
        <div class="metric-label">วันฝึกทั้งหมด</div>
        <div class="metric-value">${d.totalPrograms}</div>
        <div class="metric-note">ในทุกโปรแกรม</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon">📈</div>
        <div class="metric-label">Workout สะสม</div>
        <div class="metric-value">${d.totalLogs}</div>
        <div class="metric-note">ตั้งแต่เริ่มใช้งาน</div>
      </div>
    </div>

    <div class="package-summary-grid">
      <div class="package-summary active"><span>●</span><div><b>${d.activePackages}</b><small>แพ็กเกจ Active</small></div></div>
      <div class="package-summary soon"><span>⏳</span><div><b>${d.expiringSoon}</b><small>ใกล้หมดอายุ</small></div></div>
      <div class="package-summary expired"><span>⛔</span><div><b>${d.expired}</b><small>หมดอายุ</small></div></div>
    </div>

    ${d.expiringSoon||d.expired?`<div class="subscription-alert">
      <div><strong>แจ้งเตือนแพ็กเกจสมาชิก</strong><span>${d.expiringSoon?`${d.expiringSoon} คนใกล้หมดอายุ`:""}${d.expiringSoon&&d.expired?" · ":""}${d.expired?`${d.expired} คนหมดอายุแล้ว`:""}</span></div>
      <button class="btn btn-pill" id="viewPackageAlerts">ตรวจสอบ</button>
    </div>`:""}

    <div class="status-strip">
      <div>
        <strong>ระบบพร้อมใช้งาน 🟢</strong>
        <span style="display:block">Firebase เชื่อมต่อและบันทึกอัตโนมัติ</span>
      </div>
      <span class="badge badge-accent">LIVE</span>
    </div>

    <div class="section-heading">
      <h3>Quick Actions</h3>
      <span class="small">เข้าถึงเมนูสำคัญ</span>
    </div>

    <div class="quick-grid">
      <button class="quick-action" id="quickCustomers">
        <span class="emoji">👤</span>
        <b>จัดการลูกเทรน</b>
        <span>โปรไฟล์ โปรแกรม และผลการฝึก</span>
      </button>
      <button class="quick-action" id="quickTemplates"><span class="emoji">📋</span><b>ชุดโปรแกรม</b><span>สร้างและเซฟโปรแกรมใช้ซ้ำ</span></button><button class="quick-action" id="quickLibrary">
        <span class="emoji">🏋️</span>
        <b>คลังท่าออกกำลังกาย</b>
        <span>เพิ่มท่าและวิดีโอประกอบ</span>
      </button>
    </div>

    <div class="section-heading">
      <h3>ลูกเทรนล่าสุด</h3>
      <button class="btn btn-pill" id="viewAllCustomers">ดูทั้งหมด</button>
    </div>

    <div class="stack">
      ${recent.length?recent.map(customerCard).join(""):`
        <div class="empty-state">
          <span class="emoji">🚀</span>
          ยังไม่มีลูกเทรน เริ่มเพิ่มคนแรกได้เลย
        </div>`}
    </div>`;

  bindNav();
  const goCustomers=()=>{S.screen="customers";S.dashboardMode=false;renderFromTop()};
  $("#dashAddCustomer").onclick=()=>{S.screen="customers";S.dashboardMode=false;S.showAdd=true;renderFromTop()};
  $("#dashOpenLibrary").onclick=()=>{S.screen="catalog";renderFromTop()};
  $("#quickCustomers").onclick=goCustomers;
  if($("#quickTemplates"))$("#quickTemplates").onclick=()=>{S.screen="templates";S.dashboardMode=false;renderFromTop()};
  $("#quickLibrary").onclick=()=>{S.screen="catalog";renderFromTop()};
  $("#viewAllCustomers").onclick=goCustomers;
  if($("#viewPackageAlerts"))$("#viewPackageAlerts").onclick=goCustomers;
  $$("[data-customer]").forEach(b=>b.onclick=()=>{S.customerId=b.dataset.customer;S.screen="program";S.programTab="overview";renderFromTop()});
}

function renderCustomers(){
  $("#app").innerHTML=`
    ${nav("customers")}
    <h1>Trainer Progress</h1>
    <p class="muted">เลือกลูกเทรนเพื่อจัดWorkout Planหรือดูผลการฝึก</p>
    <input class="input" id="searchCustomer" placeholder="ค้นหาชื่อหรือรหัสสมาชิก..." style="margin-bottom:10px">
    <button class="btn btn-block" id="toggleAdd">+ เพิ่มลูกเทรน</button>
    ${S.showAdd?`<div class="card add-customer-card">
      <h3>เพิ่มลูกเทรนใหม่</h3>
      <div class="grid2">
        <label class="field-label">ชื่อลูกเทรน
          <input class="input" id="newCustomer" placeholder="เช่น Sun">
        </label>
        <label class="field-label">ระยะเวลาที่สมัคร
          <div class="month-input-wrap">
            <input class="input" id="subscriptionMonths" type="number" inputmode="numeric" min="1" max="36" value="3">
            <span>เดือน</span>
          </div>
        </label>
      </div>
      <div class="package-preview" id="packagePreview"></div>
      <button class="btn btn-primary btn-block" id="addCustomer">เพิ่มลูกเทรนและเริ่มนับเวลา</button>
    </div>`:""}
    ${S.lastCode?`<div class="notice">เพิ่ม <b>${esc(S.lastCode.name)}</b> แล้ว<br>รหัสสมาชิก: <b style="color:var(--accent)">${esc(S.lastCode.code)}</b> · แพ็กเกจ ${esc(S.lastCode.subscriptionMonths||"-")} เดือน</div>`:""}
    <div class="stack" id="customerList">${S.data.customers.length?S.data.customers.map(customerCard).join(""):`<p class="small">ยังไม่มีลูกเทรน</p>`}</div>`;
  bindNav();
  const bindCards=()=>$$("[data-customer]").forEach(b=>b.onclick=()=>{S.customerId=b.dataset.customer;S.screen="program";S.programTab="overview";renderFromTop()});
  bindCards();
  $("#searchCustomer").oninput=e=>{
    const q=e.target.value.toLowerCase();
    const list=S.data.customers.filter(c=>c.name.toLowerCase().includes(q)||c.code.includes(q));
    $("#customerList").innerHTML=list.length?list.map(customerCard).join(""):`<p class="small">ไม่พบข้อมูล</p>`;bindCards();
  };
  $("#toggleAdd").onclick=()=>{S.showAdd=!S.showAdd;render()};
  const updatePackagePreview=()=>{
    if(!$("#subscriptionMonths")||!$("#packagePreview"))return;
    const months=Math.max(1,Number($("#subscriptionMonths").value||1));
    const start=new Date();
    const end=addMonthsSafe(start,months);
    $("#packagePreview").innerHTML=`<span>📅 เริ่ม ${formatThaiDate(start)}</span><span>🏁 สิ้นสุด ${formatThaiDate(end)}</span><span>⏱ ${months} เดือน</span>`;
  };
  if($("#subscriptionMonths")){
    $("#subscriptionMonths").oninput=updatePackagePreview;
    updatePackagePreview();
  }
  if($("#addCustomer"))$("#addCustomer").onclick=()=>{
    const name=$("#newCustomer").value.trim();
    const subscriptionMonths=Math.max(1,Number($("#subscriptionMonths")?.value||1));
    if(!name)return alert("กรุณากรอกชื่อลูกเทรน");
    if(!Number.isFinite(subscriptionMonths)||subscriptionMonths<1)return alert("กรุณากรอกระยะเวลาอย่างน้อย 1 เดือน");
    const id=uid(),used=S.data.customers.map(c=>c.code);let code;
    do{code=String(Math.floor(10000+Math.random()*90000))}while(used.includes(code));
    S.data.customers.push({
      id,
      name,
      code,
      startDate:today(),
      startDateISO:isoToday(),
      subscriptionMonths
    });
    S.data.programs[id]={days:[]};
    S.data.logs[id]=[];
    S.data.bodyStats[id]=[];
    S.showAdd=false;
    S.lastCode={name,code,subscriptionMonths};
    save();
    renderFromTop();
  };
}


function cloneTemplateExercise(ex){
  return {id:uid(),name:String(ex?.name??""),catalogId:ex?.catalogId==null?null:String(ex.catalogId),
    sets:String(ex?.sets??"3"),reps:String(ex?.reps??"10"),weight:String(ex?.weight??""),
    restMinutes:String(ex?.restMinutes??""),notes:String(ex?.notes??"")};
}
function renderTemplates(){
  const templates=asArray(S.data.programTemplates);
  if(S.templateMode==="edit"){
    const current=templates.find(t=>String(t.id)===String(S.templateId));
    const template=current||S._newTemplateDraft||{id:null,name:"",description:"",category:"General",exercises:[]};
    $("#app").innerHTML=`
      ${nav("templates")}
      <button class="btn btn-ghost" id="backTemplates">‹ Program Sets</button>
      <h1>${template.id?"แก้ไขชุดโปรแกรม":"สร้างชุดโปรแกรมใหม่"}</h1>
      <p class="muted">เซฟไว้ใช้ซ้ำกับลูกเทรนหลายคนได้</p>
      <div class="card">
        <div class="grid2">
          <label class="field-label">ชื่อชุดโปรแกรม<input class="input" id="templateName" value="${esc(template.name)}" placeholder="เช่น Full Body Beginner"></label>
          <label class="field-label">ประเภท<select class="input" id="templateCategory">${["General","Strength","Hypertrophy","Fat Loss","Mobility","Beginner","Advanced"].map(x=>`<option ${template.category===x?"selected":""}>${x}</option>`).join("")}</select></label>
        </div>
        <label class="field-label" style="margin-top:10px">รายละเอียด<textarea class="input" id="templateDescription" rows="2">${esc(template.description)}</textarea></label>
      </div>
      <div class="section-heading"><h3>ท่าออกกำลังกาย</h3><span class="small">${asArray(template.exercises).length} ท่า</span></div>
      ${asArray(template.exercises).map((ex,i)=>{const ce=ex.catalogId?findCatalog(ex.catalogId):null;return `<div class="exercise">
        <div class="row-between"><b>${i+1}. ${esc(ce?.name||ex.name||"(ไม่มีชื่อท่า)")}</b><button class="btn-danger" data-remove-template-ex="${ex.id}">×</button></div>
        <div class="grid3" style="margin-top:8px">
          <input class="input" placeholder="เซ็ท" value="${esc(ex.sets)}" data-template-field="sets|${ex.id}">
          <input class="input" placeholder="ครั้ง" value="${esc(ex.reps)}" data-template-field="reps|${ex.id}">
          <input class="input" placeholder="น้ำหนัก kg" value="${esc(ex.weight)}" data-template-field="weight|${ex.id}">
        </div>
        <div class="grid2" style="margin-top:8px">
          <input class="input" placeholder="พัก (นาที)" value="${esc(ex.restMinutes)}" data-template-field="restMinutes|${ex.id}">
          <input class="input" placeholder="หมายเหตุ" value="${esc(ex.notes)}" data-template-field="notes|${ex.id}">
        </div>
      </div>`}).join("")||`<div class="empty-state"><span class="emoji">🏋️</span>ยังไม่มีท่า</div>`}
      <div class="card">
        <div class="row">
          <select class="input" id="templateExerciseSelect"><option value="">เลือกท่า</option>${catalogOptions()}<option value="__custom__">ท่ากำหนดเอง</option></select>
          <button class="btn btn-primary" id="addTemplateExercise">เพิ่ม</button>
        </div>
      </div>
      <div class="sticky-save-bar"><button class="btn" id="cancelTemplate">ยกเลิก</button><button class="btn btn-primary" id="saveTemplate">บันทึกชุดโปรแกรม</button></div>`;
    bindNav();
    const draft={...template,exercises:asArray(template.exercises).map(ex=>({...ex}))};
    const persistDraft=()=>{ if(template.id){const idx=S.data.programTemplates.findIndex(t=>String(t.id)===String(template.id));S.data.programTemplates[idx]={...draft,id:String(template.id)};}else S._newTemplateDraft=draft; };
    $("#backTemplates").onclick=$("#cancelTemplate").onclick=()=>{S.templateMode="list";S.templateId=null;renderFromTop()};
    $$("[data-template-field]").forEach(i=>i.oninput=()=>{const [f,id]=i.dataset.templateField.split("|");const ex=draft.exercises.find(x=>String(x.id)===String(id));if(ex)ex[f]=i.value;});
    $$("[data-remove-template-ex]").forEach(b=>b.onclick=()=>{draft.exercises=draft.exercises.filter(x=>String(x.id)!==String(b.dataset.removeTemplateEx));persistDraft();render()});
    $("#addTemplateExercise").onclick=()=>{const v=$("#templateExerciseSelect").value;if(!v)return;const ce=v==="__custom__"?null:findCatalog(v);draft.exercises.push({id:uid(),name:ce?.name||"ท่ากำหนดเอง",catalogId:ce?String(v):null,sets:"3",reps:"10",weight:"",restMinutes:"",notes:""});persistDraft();render()};
    $("#saveTemplate").onclick=()=>{const name=$("#templateName").value.trim();if(!name)return alert("กรุณากรอกชื่อชุดโปรแกรม");draft.name=name;draft.category=$("#templateCategory").value;draft.description=$("#templateDescription").value.trim();if(template.id){const idx=S.data.programTemplates.findIndex(t=>String(t.id)===String(template.id));S.data.programTemplates[idx]={...draft,id:String(template.id)}}else{S.data.programTemplates.push({...draft,id:uid()});delete S._newTemplateDraft}save();S.templateMode="list";S.templateId=null;renderFromTop()};
    return;
  }
  $("#app").innerHTML=`
    ${nav("templates")}
    <section class="hero-dashboard"><div class="hero-eyebrow">📚 WORKOUT PROGRAM LIBRARY</div><h1 class="hero-title">ชุดโปรแกรมออกกำลังกาย</h1><p class="hero-subtitle">สร้างโปรแกรมมาตรฐานไว้ แล้วนำไปกำหนดให้ลูกเทรนได้ทันที</p><div class="hero-actions"><button class="btn btn-primary" id="createTemplate">＋ สร้างชุดโปรแกรม</button></div></section>
    <div class="template-list">${templates.length?templates.map(t=>`<div class="template-card"><div class="row-between"><div><span class="template-category">${esc(t.category)}</span><h3>${esc(t.name)}</h3><p class="small">${esc(t.description||"ไม่มีรายละเอียด")}</p></div><span class="template-count">${asArray(t.exercises).length}<small>ท่า</small></span></div><div class="template-actions"><button class="btn" data-edit-template="${t.id}">แก้ไข</button><button class="btn" data-copy-template="${t.id}">คัดลอก</button><button class="btn-danger" data-delete-template="${t.id}">ลบ</button></div></div>`).join(""):`<div class="empty-state"><span class="emoji">📋</span>ยังไม่มีชุดโปรแกรม</div>`}</div>`;
  bindNav();
  $("#createTemplate").onclick=()=>{S.templateMode="edit";S.templateId=null;S._newTemplateDraft={id:null,name:"",description:"",category:"General",exercises:[]};renderFromTop()};
  $$("[data-edit-template]").forEach(b=>b.onclick=()=>{S.templateMode="edit";S.templateId=b.dataset.editTemplate;renderFromTop()});
  $$("[data-copy-template]").forEach(b=>b.onclick=()=>{const t=templates.find(x=>String(x.id)===String(b.dataset.copyTemplate));S.data.programTemplates.push({...t,id:uid(),name:`${t.name} (Copy)`,exercises:asArray(t.exercises).map(cloneTemplateExercise)});save();renderFromTop()});
  $$("[data-delete-template]").forEach(b=>b.onclick=()=>{const t=templates.find(x=>String(x.id)===String(b.dataset.deleteTemplate));if(confirm(`ลบชุดโปรแกรม "${t.name}" ใช่หรือไม่?`)){S.data.programTemplates=S.data.programTemplates.filter(x=>String(x.id)!==String(t.id));save();renderFromTop()}});
}

function renderCatalog(){
  const cats=S.data.catalog.categories.map(cat=>`
    <div class="card">
      <div class="row-between">
        <input class="input" value="${esc(cat.name)}" data-cat-name="${cat.id}">
        <button class="btn-danger" data-remove-cat="${cat.id}">ลบ</button>
      </div>
      ${cat.exercises.map(ex=>`<div class="row" style="margin-top:8px">
        <input class="input" placeholder="ชื่อท่า" value="${esc(ex.name)}" data-ex-name="${cat.id}|${ex.id}">
        <input class="input" placeholder="ลิงก์วิดีโอ" value="${esc(ex.videoUrl||"")}" data-ex-url="${cat.id}|${ex.id}">
        <button class="btn-danger" data-remove-ex="${cat.id}|${ex.id}">×</button>
      </div>`).join("")}
      <button class="btn btn-block" data-add-ex="${cat.id}" style="margin-top:9px">+ เพิ่มท่า</button>
    </div>`).join("");
  $("#app").innerHTML=`
    ${nav("catalog")}
    <h1>Exercise Library</h1>
    <p class="muted">สร้างหมวดและแนบลิงก์วิดีโอสำหรับเลือกใช้ในWorkout Plan</p>
    ${cats||`<p class="small">ยังไม่มีหมวดหมู่</p>`}
    <div class="row"><input class="input" id="newCat" placeholder="ชื่อหมวดหมู่ใหม่"><button class="btn btn-primary" id="addCat">เพิ่มหมวด</button></div>`;
  bindNav();
  $("#addCat").onclick=()=>{const name=$("#newCat").value.trim();if(!name)return;S.data.catalog.categories.push({id:uid(),name,exercises:[]});save();render()};
  $$("[data-cat-name]").forEach(i=>i.oninput=()=>{S.data.catalog.categories.find(c=>String(c.id)===String(i.dataset.catName)).name=i.value;save()});
  $$("[data-remove-cat]").forEach(b=>b.onclick=()=>{S.data.catalog.categories=S.data.catalog.categories.filter(c=>c.id!==b.dataset.removeCat);save();render()});
  $$("[data-add-ex]").forEach(b=>b.onclick=()=>{S.data.catalog.categories.find(c=>String(c.id)===String(b.dataset.addEx)).exercises.push({id:uid(),name:"",videoUrl:""});save();render()});
  $$("[data-remove-ex]").forEach(b=>b.onclick=()=>{const [cid,eid]=b.dataset.removeEx.split("|"),c=S.data.catalog.categories.find(x=>String(x.id)===String(cid));c.exercises=c.exercises.filter(x=>x.id!==eid);save();render()});
  $$("[data-ex-name]").forEach(i=>i.oninput=()=>{const [cid,eid]=i.dataset.exName.split("|");S.data.catalog.categories.find(c=>c.id===cid).exercises.find(e=>e.id===eid).name=i.value;save()});
  $$("[data-ex-url]").forEach(i=>i.oninput=()=>{const [cid,eid]=i.dataset.exUrl.split("|");S.data.catalog.categories.find(c=>c.id===cid).exercises.find(e=>e.id===eid).videoUrl=i.value;save()});
}
function catalogOptions(){
  return S.data.catalog.categories.map(c=>`<optgroup label="${esc(c.name)}">${c.exercises.map(e=>`<option value="${e.id}">${esc(e.name||"(ไม่มีชื่อ)")}</option>`).join("")}</optgroup>`).join("");
}
function findCatalog(id){
  for(const c of S.data.catalog.categories){const e=c.exercises.find(x=>String(x.id)===String(id));if(e)return {...e,category:c.name}}
  return null;
}
function renderProgram(){
  const c=S.data.customers.find(x=>String(x.id)===String(S.customerId));
  if(!c){S.screen="customers";return renderCustomers()}
  const p=S.data.programs[c.id]||{days:[]},logs=S.data.logs[c.id]||[],stats=S.data.bodyStats[c.id]||[];
  const pkg=packageInfo(c);
  const programHtml=p.days.map(day=>`<div class="card">
    <div class="row-between">
      <input class="input" value="${esc(day.name)}" data-day-name="${day.id}">
      <button class="btn-danger" data-remove-day="${day.id}">ลบวัน</button>
    </div>
    ${day.exercises.map(ex=>{const ce=ex.catalogId?findCatalog(ex.catalogId):null;return `<div class="exercise">
      <div class="row-between"><b>${esc(ce?.name||ex.name||"(ไม่มีชื่อท่า)")}</b><button class="btn-danger" data-remove-program-ex="${day.id}|${ex.id}">×</button></div>
      <div class="grid3" style="margin-top:8px">
        <input class="input" placeholder="เซ็ท" value="${esc(ex.sets)}" data-field="sets" data-day="${day.id}" data-ex="${ex.id}">
        <input class="input" placeholder="ครั้ง" value="${esc(ex.reps)}" data-field="reps" data-day="${day.id}" data-ex="${ex.id}">
        <input class="input" placeholder="น้ำหนัก kg" value="${esc(ex.weight||"")}" data-field="weight" data-day="${day.id}" data-ex="${ex.id}">
      </div>
      <div class="grid2" style="margin-top:8px">
        <input class="input" placeholder="พัก (นาที)" value="${esc(ex.restMinutes||"")}" data-field="restMinutes" data-day="${day.id}" data-ex="${ex.id}">
        <input class="input" placeholder="หมายเหตุ" value="${esc(ex.notes||"")}" data-field="notes" data-day="${day.id}" data-ex="${ex.id}">
      </div>
    </div>`}).join("")}
    <div class="row"><select class="input" data-select-day="${day.id}"><option value="">เลือกท่าจากคลัง</option>${catalogOptions()}<option value="__custom__">ท่ากำหนดเอง</option></select><button class="btn btn-primary" data-add-program-ex="${day.id}">เพิ่ม</button></div>
  </div>`).join("");
  const latest=stats[stats.length-1]||{};
  const latest=stats[stats.length-1]||{};
  const weeklyCount=countThisWeekLogs(logs);
  const totalExercises=asArray(p.days).reduce((sum,day)=>sum+asArray(day.exercises).length,0);
  const lastWorkout=logs.length?logs[logs.length-1]:null;
  const completionTarget=Math.max(p.days.length,1);
  const completion=Math.min(100,Math.round((weeklyCount/completionTarget)*100));

  const overview=`
    <section class="client-hero">
      <div class="client-hero-top">
        <div>
          <div class="hero-eyebrow">👤 CLIENT DASHBOARD</div>
          <h2>${esc(c.name)}</h2>
          <p class="small">รหัส ${esc(c.code)} · เริ่มเทรน ${esc(c.startDate)}</p>
          <div class="client-package-row">
            ${packageBadge(c)}
            ${pkg.configured?`<span class="small">สิ้นสุด ${formatThaiDate(pkg.end)} · แพ็กเกจ ${pkg.months} เดือน</span>`:`<span class="small">กรุณากำหนดอายุแพ็กเกจ</span>`}
          </div>
        </div>
        <div class="client-score"><b>${completion}%</b><span>Weekly Goal</span></div>
      </div>
      <div class="progress-bar" style="margin-top:14px"><span style="width:${completion}%"></span></div>
    </section>
    <div class="dashboard-grid">
      <div class="metric-card mint"><div class="metric-icon">✅</div><div class="metric-label">Workout สัปดาห์นี้</div><div class="metric-value">${weeklyCount}</div><div class="metric-note">เป้าหมาย ${p.days.length||0} วัน</div></div>
      <div class="metric-card"><div class="metric-icon">🔥</div><div class="metric-label">Workout สะสม</div><div class="metric-value">${logs.length}</div><div class="metric-note">ตั้งแต่เริ่มโปรแกรม</div></div>
      <div class="metric-card warning"><div class="metric-icon">📋</div><div class="metric-label">วันฝึกในโปรแกรม</div><div class="metric-value">${p.days.length}</div><div class="metric-note">รวม ${totalExercises} ท่า</div></div>
      <div class="metric-card mint"><div class="metric-icon">⚖️</div><div class="metric-label">น้ำหนักล่าสุด</div><div class="metric-value">${esc(latest.weight||"-")}</div><div class="metric-note">${latest.weight?"kg":"ยังไม่มีข้อมูล"}</div></div>
    </div>
    <div class="client-subscription-card ${pkg.className}">
      <div class="subscription-icon">${pkg.status==="expired"?"⛔":pkg.status==="soon"?"⏳":pkg.status==="active"?"📆":"🗓️"}</div>
      <div>
        <span>สถานะแพ็กเกจ</span>
        <b>${esc(pkg.label)}</b>
        <small>${pkg.configured?`เริ่ม ${formatThaiDate(pkg.start)} · สิ้นสุด ${formatThaiDate(pkg.end)}`:"ยังไม่มีการกำหนดระยะเวลาสมัคร"}</small>
      </div>
    </div>
    <div class="section-heading"><h3>Body Snapshot</h3><span class="small">ข้อมูลล่าสุด</span></div>
    <div class="body-snapshot">
      <div><span>💪 กล้ามเนื้อ</span><b>${esc(latest.muscleMass||"-")} ${latest.muscleMass?"kg":""}</b></div>
      <div><span>📉 ไขมัน</span><b>${esc(latest.bodyFat||"-")} ${latest.bodyFat?"%":""}</b></div>
      <div><span>🙂 Mood</span><b>${esc(latest.mood||"-")}</b></div>
    </div>
    <div class="section-heading"><h3>กิจกรรมล่าสุด</h3><button class="btn btn-pill" id="openProgressFromOverview">ดู Progress</button></div>
    ${lastWorkout?logHtml(lastWorkout):`<div class="empty-state"><span class="emoji">🏁</span>ยังไม่มี Workout Log</div>`}
    <div class="quick-grid" style="margin-top:12px">
      <button class="quick-action" id="openPlanFromOverview"><span class="emoji">🏋️</span><b>จัด Workout Plan</b><span>เพิ่มวันฝึกและท่าออกกำลังกาย</span></button>
      <button class="quick-action" id="openProgressQuick"><span class="emoji">📈</span><b>ดู Progress</b><span>ประวัติการฝึกและ Check-in</span></button>
    </div>`;

  const dashboard=`<div class="stat-grid">
    <div class="stat"><span class="small">น้ำหนักล่าสุด</span><b>${esc(latest.weight||"-")}</b><span class="small">kg</span></div>
    <div class="stat"><span class="small">กล้ามเนื้อล่าสุด</span><b>${esc(latest.muscleMass||"-")}</b><span class="small">kg</span></div>
    <div class="stat"><span class="small">ไขมันล่าสุด</span><b>${esc(latest.bodyFat||"-")}</b><span class="small">%</span></div>
  </div>
  <h3>ประวัติการออกกำลังกาย</h3>${logs.length?logs.slice().reverse().map(logHtml).join(""):`<p class="small">ยังไม่มีข้อมูล</p>`}
  <h3 style="margin-top:20px">ประวัติ Check-in</h3>${stats.length?stats.slice().reverse().map(s=>`<div class="card"><div class="row-between"><b>${esc(s.date)}</b><span class="small">${s.mood?`${esc(s.mood)} · `:""}น้ำหนัก ${esc(s.weight||"-")} kg · กล้ามเนื้อ ${esc(s.muscleMass||"-")} kg · ไขมัน ${esc(s.bodyFat||"-")}%</span></div></div>`).join(""):`<p class="small">ยังไม่มีข้อมูล</p>`}`;
  $("#app").innerHTML=`
    <button class="btn btn-ghost" id="backCustomers">‹ ลูกเทรนทั้งหมด</button>
    ${S.programTab!=="overview"?`<h2>${esc(c.name)} <span class="badge">รหัส ${esc(c.code)}</span></h2><p class="small">เริ่มเทรน ${esc(c.startDate)} · ${packageBadge(c)}</p>`:""}
    <div class="nav client-nav">
      <button data-ptab="overview" class="${S.programTab==="overview"?"active":""}">Dashboard</button>
      <button data-ptab="program" class="${S.programTab==="program"?"active":""}">Workout Plan</button>
      <button data-ptab="dashboard" class="${S.programTab==="dashboard"?"active":""}">Progress</button>
    </div>
    ${S.programTab==="overview"?overview:S.programTab==="dashboard"?dashboard:`${programHtml}<div class="card assign-template-card"><h3>เพิ่มวันฝึก</h3><p class="small">สร้างวันเปล่า หรือเลือกชุดโปรแกรมที่เซฟไว้</p><select class="input" id="assignTemplateSelect"><option value="">เลือกชุดโปรแกรม</option>${asArray(S.data.programTemplates).map(t=>`<option value="${t.id}">${esc(t.name)} · ${asArray(t.exercises).length} ท่า</option>`).join("")}</select><div class="grid2" style="margin-top:9px"><button class="btn" id="addBlankDay">＋ วันเปล่า</button><button class="btn btn-primary" id="addDayFromTemplate">ใช้ชุดโปรแกรม</button></div></div>`}`;
  $("#backCustomers").onclick=()=>{S.screen="customers";S.dashboardMode=false;renderFromTop()};
  $$("[data-ptab]").forEach(b=>b.onclick=()=>{S.programTab=b.dataset.ptab;renderFromTop()});
  if($("#openPlanFromOverview"))$("#openPlanFromOverview").onclick=()=>{S.programTab="program";renderFromTop()};
  if($("#openProgressFromOverview"))$("#openProgressFromOverview").onclick=()=>{S.programTab="dashboard";renderFromTop()};
  if($("#openProgressQuick"))$("#openProgressQuick").onclick=()=>{S.programTab="dashboard";renderFromTop()};
  if($("#addBlankDay"))$("#addBlankDay").onclick=()=>{p.days.push({id:uid(),name:`วันที่ ${p.days.length+1}`,exercises:[]});save();renderFromTop()};
  if($("#addDayFromTemplate"))$("#addDayFromTemplate").onclick=()=>{const id=$("#assignTemplateSelect").value;if(!id)return alert("กรุณาเลือกชุดโปรแกรม");const t=asArray(S.data.programTemplates).find(x=>String(x.id)===String(id));if(!t)return;p.days.push({id:uid(),name:t.name,templateId:String(t.id),exercises:asArray(t.exercises).map(cloneTemplateExercise)});save();showToast(`เพิ่ม ${t.name} แล้ว`);renderFromTop()};
  $$("[data-day-name]").forEach(i=>i.oninput=()=>{p.days.find(d=>String(d.id)===String(i.dataset.dayName)).name=i.value;save()});
  $$("[data-remove-day]").forEach(b=>b.onclick=()=>{p.days=p.days.filter(d=>d.id!==b.dataset.removeDay);save();render()});
  $$("[data-add-program-ex]").forEach(b=>b.onclick=()=>{const day=p.days.find(d=>String(d.id)===String(b.dataset.addProgramEx)),sel=$(`[data-select-day="${day.id}"]`),v=sel.value;if(!v)return;const ce=v==="__custom__"?null:findCatalog(v);day.exercises.push({id:uid(),name:ce?.name||"",catalogId:ce?v:null,sets:"3",reps:"10",weight:"",restMinutes:"",notes:""});save();render()});
  $$("[data-remove-program-ex]").forEach(b=>b.onclick=()=>{const [did,eid]=b.dataset.removeProgramEx.split("|"),d=p.days.find(x=>String(x.id)===String(did));d.exercises=d.exercises.filter(x=>x.id!==eid);save();render()});
  $$("[data-field]").forEach(i=>i.oninput=()=>{const d=p.days.find(x=>String(x.id)===String(i.dataset.day)),e=d.exercises.find(x=>String(x.id)===String(i.dataset.ex));e[i.dataset.field]=i.value;save()});
}
function logHtml(l){
  const entries=asArray(l?.entries);
  return `<div class="card"><div class="row-between"><b>${esc(l?.dayName||"Workout")}</b><span class="small">${esc(l?.date||"-")}</span></div>${entries.map(e=>`<div class="log">${esc(e?.name||"ท่าออกกำลังกาย")}: ${esc(e?.actualSets||"-")} เซ็ท × ${esc(e?.actualReps||"-")} ครั้ง ${e?.weight?`@ ${esc(e.weight)} kg`:""} ${e?.completed?"✓":""}</div>`).join("")}</div>`;
}
function renderCustomer(){
  const c=S.data.customers.find(x=>String(x.id)===String(S.customerId));
  if(!c){logout();return}
  const p=S.data.programs[c.id]||{days:[]},logs=S.data.logs[c.id]||[],stats=S.data.bodyStats[c.id]||[];
  const memberPkg=packageInfo(c);
  if(!S.activeDayId&&p.days.length)S.activeDayId=p.days[0].id;
  const day=p.days.find(d=>String(d.id)===String(S.activeDayId));
  const existing=day?logs.find(l=>String(l.dayId)===String(day.id)&&l.date===today()):null;
  const tabs=p.days.map(d=>`<button class="btn btn-pill ${String(d.id)===String(S.activeDayId)?"active":""}" data-daytab="${d.id}">${esc(d.name)}</button>`).join("");
  let workout="";
  if(!p.days.length)workout=`<div class="card"><p class="small">เทรนเนอร์ยังไม่ได้กำหนดWorkout Plan</p></div>`;
  else if(!day)workout=`<div class="card"><p class="small">ไม่พบวันฝึกที่เลือก กรุณาเลือกวันฝึกใหม่</p></div>`;
  else if(existing)workout=`<div class="card success"><div class="success-icon">✓</div><h3>บันทึกTodayเรียบร้อยแล้ว</h3><p class="small">${esc(existing.dayName)} · ${esc(existing.date)}</p>${existing.entries.map(e=>`<div class="log">${esc(e.name)}: ${esc(e.actualSets||"-")} × ${esc(e.actualReps||"-")} ${e.completed?"✓":""}</div>`).join("")}<button class="btn" id="editToday" style="margin-top:14px">แก้ไข</button></div>`;
  else workout=`<div class="card">${day.exercises.length?day.exercises.map(ex=>{const ce=ex.catalogId?findCatalog(ex.catalogId):null,e=S.entries[ex.id]||{};return `<div class="exercise"><div class="exercise-title">${esc(ce?.name||ex.name)}</div><div class="tags"><span class="tag">${esc(ex.sets)} เซ็ท</span><span class="tag">${esc(ex.reps)} ครั้ง</span>${ex.weight?`<span class="tag">${esc(ex.weight)} kg</span>`:""}</div>${ce?.videoUrl?`<a class="video" target="_blank" rel="noopener" href="${esc(ce.videoUrl)}">▶ ดูวิดีโอ</a>`:""}<div class="grid3 log-grid" style="margin-top:10px"><input class="input" placeholder="เซ็ทที่ทำได้" value="${esc(e.actualSets||"")}" data-entry="actualSets|${ex.id}"><input class="input" placeholder="ครั้งที่ทำได้" value="${esc(e.actualReps||"")}" data-entry="actualReps|${ex.id}"><input class="input" placeholder="น้ำหนัก kg" value="${esc(e.weight||"")}" data-entry="weight|${ex.id}"></div><label class="small" style="display:block;margin-top:9px"><input type="checkbox" data-check="${ex.id}" ${e.completed?"checked":""}> ทำแล้ว</label></div>`}).join(""):`<p class="small">Todayยังไม่มีท่าออกกำลังกาย</p>`}<button class="btn btn-primary btn-block" id="saveWorkout">Complete Workout</button></div>`;
  const body=`<div class="card">
    <h3>Daily Check-in</h3>
    <p class="small">วันนี้คุณรู้สึกอย่างไร</p>
    <div class="mood-row" id="moodRow">
      <button class="mood-option" data-mood="ยอดเยี่ยม"><span class="face">😄</span><small>ยอดเยี่ยม</small></button>
      <button class="mood-option" data-mood="ดี"><span class="face">🙂</span><small>ดี</small></button>
      <button class="mood-option" data-mood="ปกติ"><span class="face">😐</span><small>ปกติ</small></button>
      <button class="mood-option" data-mood="ล้า"><span class="face">😮‍💨</span><small>ล้า</small></button>
      <button class="mood-option" data-mood="ควรพัก"><span class="face">😴</span><small>ควรพัก</small></button>
    </div>
    <div class="grid3" style="margin-top:12px">
      <input class="input" id="weight" placeholder="น้ำหนัก kg">
      <input class="input" id="muscle" placeholder="กล้ามเนื้อ kg">
      <input class="input" id="fat" placeholder="ไขมัน %">
    </div>
    <button class="btn btn-primary btn-block" id="saveBody" style="margin-top:10px">Save Check-in</button>
  </div>${stats.length?stats.slice().reverse().map(s=>`<div class="card"><div class="row-between"><b>${esc(s.date)}</b><span class="small">น้ำหนัก ${esc(s.weight||"-")} kg · กล้ามเนื้อ ${esc(s.muscleMass||"-")} kg · ไขมัน ${esc(s.bodyFat||"-")}%</span></div></div>`).join(""):`<p class="small">ยังไม่มีประวัติ</p>`}`;
  $("#app").innerHTML=`
    <section class="hero-dashboard">
      <div class="hero-eyebrow">🔥 MEMBER DASHBOARD</div>
      <h2 class="hero-title">สวัสดี ${esc(c.name)}</h2>
      <p class="hero-subtitle">${today()} · รหัสสมาชิก <b style="color:var(--mint)">${esc(c.code)}</b></p>
      <div class="member-package-status ${memberPkg.className}">
        <span>${memberPkg.status==="expired"?"⛔":memberPkg.status==="soon"?"⏳":memberPkg.status==="active"?"📅":"🗓️"}</span>
        <div><b>${esc(memberPkg.label)}</b><small>${memberPkg.configured?`ใช้งานถึง ${formatThaiDate(memberPkg.end)}`:"กรุณาติดต่อเทรนเนอร์เพื่อกำหนดแพ็กเกจ"}</small></div>
      </div>
    </section>
    <div class="nav"><button data-ctab="today" class="${S.customerTab==="today"?"active":""}">Today</button><button data-ctab="body" class="${S.customerTab==="body"?"active":""}">Check-in</button></div>
    ${S.customerTab==="body"?body:`<div class="day-tabs">${tabs}</div>${workout}<h3 style="margin-top:22px">Recent Workouts</h3>${logs.length?logs.slice().reverse().map(logHtml).join(""):`<p class="small">ยังไม่มีประวัติ</p>`}`}`;
  let selectedMood="";
  $$("[data-mood]").forEach(b=>b.onclick=()=>{
    selectedMood=b.dataset.mood;
    $$("[data-mood]").forEach(x=>x.classList.toggle("active",x===b));
  });
  $$("[data-ctab]").forEach(b=>b.onclick=()=>{S.customerTab=b.dataset.ctab;renderFromTop()});
  $$("[data-daytab]").forEach(b=>b.onclick=()=>{S.activeDayId=b.dataset.daytab;S.entries={};renderFromTop()});
  $$("[data-entry]").forEach(i=>i.oninput=()=>{const [field,id]=i.dataset.entry.split("|");S.entries[id]={...(S.entries[id]||{}),[field]:i.value}});
  $$("[data-check]").forEach(i=>i.onchange=()=>{S.entries[i.dataset.check]={...(S.entries[i.dataset.check]||{}),completed:i.checked}});
  if($("#editToday"))$("#editToday").onclick=()=>{existing.entries.forEach(e=>S.entries[e.exerciseId]={actualSets:e.actualSets,actualReps:e.actualReps,weight:e.weight,completed:e.completed});S.data.logs[c.id]=logs.filter(l=>l.id!==existing.id);render()};
  if($("#saveWorkout"))$("#saveWorkout").onclick=()=>{
    if(!day)return;
    const log={id:uid(),date:today(),dayId:day.id,dayName:day.name,entries:day.exercises.map(ex=>{const ce=ex.catalogId?findCatalog(ex.catalogId):null,e=S.entries[ex.id]||{};return{exerciseId:ex.id,name:ce?.name||ex.name,targetSets:ex.sets,targetReps:ex.reps,actualSets:e.actualSets||"",actualReps:e.actualReps||"",weight:e.weight||"",completed:!!e.completed}})};
    const idx=logs.findIndex(l=>l.dayId===day.id&&l.date===today());if(idx>=0){log.id=logs[idx].id;logs[idx]=log}else logs.push(log);
    S.entries={};save();render();
  };
  if($("#saveBody"))$("#saveBody").onclick=()=>{
    const entry={id:uid(),date:today(),mood:selectedMood,weight:$("#weight").value.trim(),muscleMass:$("#muscle").value.trim(),bodyFat:$("#fat").value.trim()};
    if(!entry.weight&&!entry.muscleMass&&!entry.bodyFat)return;
    const idx=stats.findIndex(x=>x.date===entry.date);if(idx>=0){entry.id=stats[idx].id;stats[idx]=entry}else stats.push(entry);save();render();
  };
}

$("#trainerBtn").onclick=()=>{$("#pinModal").style.display="flex";$("#pinInput").focus()};
$("#logoutBtn").onclick=logout;
$("#pinCancel").onclick=()=>$("#pinModal").style.display="none";
$("#pinConfirm").onclick=()=>{
  if($("#pinInput").value.trim()==="0409"){S.role="trainer";S.screen="customers";S.dashboardMode=true;$("#pinModal").style.display="none";$("#pinInput").value="";render()}
  else $("#pinError").hidden=false;
};
$("#pinInput").onkeydown=e=>{if(e.key==="Enter")$("#pinConfirm").click()};
$("#pinModal").onclick=e=>{if(e.target.id==="pinModal")$("#pinModal").style.display="none"};

init();

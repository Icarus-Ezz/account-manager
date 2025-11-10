// ============================
// Config
// ============================
const CONFIG = {
  GITHUB_REPO: "Icarus-Ezz/account-manager",
  DATA_FILENAME: "data.json",
  GITHUB_RAW_URL: "https://raw.githubusercontent.com/Icarus-Ezz/account-manager/refs/heads/main/data.json",
  AUTO_PUSH: true,
  WEB_PASS: "PC",
  TOKEN_OBF: "gsE2KTxwSDMBPNGCuGjxRKH/AR06MQYoEl3S+MtQ2hLdkXYxcClyEw==",
  TOKEN_KEY: "e5a94676484631724869e0b18f0a937c"
};

// ============================
// Decode token
// ============================
const decodeObf = (b64, keyHex) => {
  const b = atob(b64), k = new Uint8Array(keyHex.match(/.{1,2}/g).map(x => parseInt(x, 16)));
  const out = [...b].map((c, i) => c.charCodeAt(0) ^ k[i % k.length]);
  return new TextDecoder().decode(new Uint8Array(out));
};
const GITHUB_TOKEN = decodeObf(CONFIG.TOKEN_OBF, CONFIG.TOKEN_KEY);

// ============================
// State
// ============================
let data = {}, platforms = {}, currentPlatform = null;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ============================
// Load / Save
// ============================
function loadState() {
  try {
    data = JSON.parse(localStorage.am_data_v2 || "{}");
    platforms = JSON.parse(localStorage.am_platforms_v2 || "{}");
  } catch { data = {}; platforms = {}; }
  if (!Object.keys(platforms).length) addPlatform("TikTok", "", "#ff0050"), addPlatform("Facebook", "", "#1877f2"), addPlatform("Instagram", "", "#ec4899");
  Object.keys(platforms).forEach(p => data[p] ||= []);
}
const saveState = () => {
  localStorage.am_data_v2 = JSON.stringify(data);
  localStorage.am_platforms_v2 = JSON.stringify(platforms);
};

// ============================
// UI Helpers
// ============================
const toast = (t) => {
  let el = $(".copyToast");
  if (!el) { el = document.createElement("div"); el.className = "copyToast"; document.body.append(el); }
  el.textContent = t; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1200);
};
const esc = s => (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rndColor = () => `hsl(${[200,220,260,340,20,40,120][Math.floor(Math.random()*7)]} 80% 55%)`;
function addPlatform(name, icon, color) {
  platforms[name] = { icon, color: color || rndColor() };
  data[name] ||= [];
}

// ============================
// Render Platforms
// ============================
function renderPlatforms() {
  const list = $("#platformList");
  list.innerHTML = "";
  for (const [p, m] of Object.entries(platforms)) {
    const item = document.createElement("div");
    item.className = "platform-item";
    item.dataset.name = p;
    item.innerHTML = `
      <div class="platform-thumb" style="background:${m.color}">
        ${m.icon ? `<img src="${esc(m.icon)}"/>` : `<b>${p.slice(0,2).toUpperCase()}</b>`}
      </div>
      <div class="platform-meta"><div class="title">${esc(p)}</div><div class="count">${data[p]?.length||0} tài khoản</div></div>
      <div style="margin-left:auto">
        <button data-act="edit" data-p="${p}" class="btn small">Sửa</button>
        <button data-act="del" data-p="${p}" class="btn small ghost">Xóa</button>
      </div>`;
    item.onclick = ev => { if (!ev.target.dataset.act) selectPlatform(p); };
    list.append(item);
  }
}

// ============================
// Render Accounts
// ============================
function renderAccounts() {
  const grid = $("#accountGrid");
  grid.innerHTML = "";
  if (!currentPlatform) return ($("#currentPlatformTitle").textContent = "Chọn nền tảng", $("#platformSummary").textContent = "Chọn ở sidebar.");
  const list = data[currentPlatform], meta = platforms[currentPlatform];
  $("#currentPlatformTitle").textContent = currentPlatform;
  $("#platformSummary").textContent = `${list.length} tài khoản`;
  list.forEach((acc,i)=>{
    const el = document.createElement("div");
    el.className = "card";
    el.style.background = meta.color;
    el.innerHTML = `
      <div class="head">
        <div class="info"><div class="icon-small" style="background:${meta.color}">${meta.icon?`<img src="${meta.icon}"/>`:currentPlatform[0]}</div>
          <div><h4>${esc(acc.name)}</h4><p class="muted">${esc(acc.mail)}</p></div>
        </div>
        <div><button data-a="edit" data-i="${i}" class="btn-icon"><i class="fas fa-pen"></i></button>
             <button data-a="del" data-i="${i}" class="btn-icon danger"><i class="fas fa-trash"></i></button></div>
      </div>
      <div class="details">
        <p><b>Pass:</b> <span class="blur copyField" data-copy="${esc(acc.mk)}">${esc(acc.mk)}</span></p>
        <p><b>2FA:</b> <span class="blur copyField" data-copy="${esc(acc["2fa"]||"")}">••••••••</span></p>
      </div>`;
    el.querySelectorAll("[data-a]").forEach(b=>{
      b.onclick=()=>b.dataset.a==="edit"?openAccount(i):removeAccount(i);
    });
    grid.append(el);
  });
}

// ============================
// Actions
// ============================
const selectPlatform = n => (currentPlatform=n, renderAccounts(), [...$$(".platform-item")].forEach(x=>x.style.boxShadow=""), $(`.platform-item[data-name="${n}"]`).style.boxShadow="0 0 10px #0002");
function removeAccount(i){
  if(!confirm("Xóa tài khoản này?"))return;
  data[currentPlatform].splice(i,1);
  saveState(); renderAccounts(); if(CONFIG.AUTO_PUSH) syncGit("push");
}
function openAccount(i){
  const acc = data[currentPlatform][i] || {};
  $("#accountModalTitle").textContent = (i!=null?"Sửa":"Thêm")+" tài khoản — "+currentPlatform;
  $("#acc_name").value = acc.name||""; $("#acc_mail").value = acc.mail||"";
  $("#acc_pass").value = acc.mk||""; $("#acc_2fa").value = acc["2fa"]||"";
  $("#accountModal").classList.remove("hidden");
  $("#saveAccount").onclick=()=>{
    const a={name:$("#acc_name").value,mail:$("#acc_mail").value,mk:$("#acc_pass").value,"2fa":$("#acc_2fa").value};
    if(!a.name||!a.mail||!a.mk)return toast("Điền đủ thông tin");
    if(i!=null)data[currentPlatform][i]=a; else data[currentPlatform].push(a);
    saveState(); renderAccounts(); $("#accountModal").classList.add("hidden"); if(CONFIG.AUTO_PUSH) syncGit("push");
  };
}

// ============================
// GitHub Sync
// ============================
async function syncGit(mode){
  const api=`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATA_FILENAME}`;
  if(!GITHUB_TOKEN)return toast("Không có token GitHub");
  try{
    if(mode==="pull"){
      const r=await fetch(CONFIG.GITHUB_RAW_URL+"?_="+Date.now());
      const j=await r.json();
      data=j.data||j.accounts; platforms=j.platforms||{};
      saveState(); renderPlatforms(); renderAccounts(); toast("Đã tải từ GitHub");
    } else {
      const chk=await fetch(api,{headers:{Authorization:`token ${GITHUB_TOKEN}`}}); const js=chk.ok?await chk.json():{};
      const body={message:"update",content:btoa(unescape(encodeURIComponent(JSON.stringify({data,platforms},null,2)))),sha:js.sha,branch:"main"};
      const r=await fetch(api,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`token ${GITHUB_TOKEN}`},body:JSON.stringify(body)});
      if(r.ok) toast("Đã push GitHub"); else throw await r.text();
    }
  }catch(e){toast("Lỗi sync: "+e);}
}

// ============================
// Login + Theme + Copy + Init
// ============================
function initLogin(){
  if(localStorage.app_login_pass_saved==="1")return;
  $("#loginModal").classList.remove("hidden");
  $("#loginBtn").onclick=()=>{
    if($("#loginInput").value===CONFIG.WEB_PASS){
      localStorage.app_login_pass_saved="1";
      $("#loginModal").classList.add("hidden");
    }else toast("Sai mật khẩu");
  };
}
$("#themeToggle").onchange=()=>document.documentElement.setAttribute("data-theme",$("#themeToggle").checked?"dark":"");
document.addEventListener("click",async e=>{
  if(e.target.classList.contains("copyField")){
    await navigator.clipboard.writeText(e.target.dataset.copy);
    e.target.classList.toggle("show"); toast("✓ Copied");
  }
});
$("#addAccountBtn").onclick=()=>openAccount(null);
$("#refreshData").onclick=()=>syncGit("pull");
$("#forceSync").onclick=()=>syncGit("push");

// ============================
// Random name (rút gọn)
// ============================
const listTen = {
  first: ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Đặng','Bùi','Đỗ'],
  mid: ['Văn','Thị','Minh','Thanh','Quốc','Tuấn','Đức','Hồng','Hải','Kim','Bảo','Gia'],
  last: ['Anh','Linh','Ngọc','Trang','Huy','Khánh','Vy','Phúc','Tùng','My','Hằng']
};
$("#genNameBtn")?.addEventListener("click",()=>{
  const r=a=>a[Math.floor(Math.random()*a.length)];
  $("#acc_name").value=[r(listTen.first),r(listTen.mid),r(listTen.last)].join(" ");
  toast("Đã tạo tên ngẫu nhiên");
});

// ============================
// Init
// ============================
window.addEventListener("DOMContentLoaded",()=>{
  loadState(); renderPlatforms(); initLogin();
  const f=Object.keys(platforms)[0]; if(f) selectPlatform(f);
});
window.addEventListener("DOMContentLoaded", () => {
  init();

  const go2FABtn = document.getElementById("go2FA");
  if (go2FABtn) {
    go2FABtn.addEventListener("click", () => {
      window.open("https://2fa.live/", "_blank");
    });
  }
});

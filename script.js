// ============================
// Configuration (edit here)
// ============================
const GITHUB_REPO = "Icarus-Ezz/account-manager";     // <--- sửa thành username/repo
const GITHUB_TOKEN = "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";          // <--- sửa token của bạn (PAT) hoặc để "" để tắt sync
const DATA_FILENAME = "data.json";
const AUTO_PUSH = true;                  // auto push khi có thay đổi (true/false)

// ============================
// State & Helpers
// ============================
let data = {}; // { PlatformName: [{name, mail, mk, "2fa"}], ... }
let platforms = {}; // { PlatformName: { icon, color } }
let currentPlatform = null;
let editAccountContext = null; // {platform, index} or null
let editPlatformContext = null;

const platformListEl = document.getElementById("platformList");
const accountGrid = document.getElementById("accountGrid");
const currentPlatformTitle = document.getElementById("currentPlatformTitle");
const platformSummary = document.getElementById("platformSummary");

const accountModal = document.getElementById("accountModal");
const platformModal = document.getElementById("platformModal");

// inputs
const accNameInput = document.getElementById("acc_name");
const accMailInput = document.getElementById("acc_mail");
const accPassInput = document.getElementById("acc_pass");
const acc2faInput = document.getElementById("acc_2fa");

const platNameInput = document.getElementById("plat_name");
const platIconInput = document.getElementById("plat_icon");
const platColorInput = document.getElementById("plat_color");

// load from localStorage
function loadState(){
  try{
    const s = localStorage.getItem("am_data_v2");
    const p = localStorage.getItem("am_platforms_v2");
    if(s) data = JSON.parse(s);
    if(p) platforms = JSON.parse(p);
  }catch(e){
    data = {}; platforms = {};
  }
  // ensure at least some defaults
  if (!Object.keys(platforms).length) {
    // default platforms
    addPlatformDef("TikTok", "", "#ff0050");
    addPlatformDef("Facebook", "", "#1877f2");
    addPlatformDef("Instagram", "", "#ec4899");
  }
  // ensure data keys
  Object.keys(platforms).forEach(k => { if(!data[k]) data[k] = []; });
}

function saveState(){
  localStorage.setItem("am_data_v2", JSON.stringify(data, null, 2));
  localStorage.setItem("am_platforms_v2", JSON.stringify(platforms, null, 2));
}

function addPlatformDef(name, icon, color){
  platforms[name] = { icon: icon||"", color: color||randomColor() };
  if(!data[name]) data[name] = [];
}

function randomColor(){
  // gentle pastel-ish colors
  const hues = [200, 220, 260, 340, 20, 40, 120];
  const h = hues[Math.floor(Math.random()*hues.length)];
  return `hsl(${h} 80% 55%)`;
}

// ============================
// UI rendering
// ============================
function renderPlatforms(){
  platformListEl.innerHTML = "";
  Object.keys(platforms).forEach(p => {
    const meta = platforms[p];
    const item = document.createElement("div");
    item.className = "platform-item";
    item.dataset.name = p;
    item.innerHTML = `
      <div class="platform-thumb" style="background:${meta.color}">
        ${meta.icon ? `<img src="${escapeHtml(meta.icon)}" alt="${escapeHtml(p)}" style="width:100%;height:100%;object-fit:cover"/>` : initials(p)}
      </div>
      <div class="platform-meta">
        <div class="title">${escapeHtml(p)}</div>
        <div class="count">${(data[p] ? data[p].length : 0)} tài khoản</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <button class="btn small" data-action="edit-plat" data-plat="${escapeHtml(p)}">Sửa</button>
        <button class="btn small ghost" data-action="del-plat" data-plat="${escapeHtml(p)}">Xóa</button>
      </div>
    `;
    item.addEventListener("click", (ev) => {
      // avoid activating when clicking the small buttons
      if(ev.target && ev.target.dataset && (ev.target.dataset.action)) return;
      selectPlatform(p);
    });
    platformListEl.appendChild(item);
  });
}

function initials(name){
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700">${escapeHtml(name.slice(0,2).toUpperCase())}</div>`;
}

function renderAccounts(){
  accountGrid.innerHTML = "";
  if(!currentPlatform){
    currentPlatformTitle.innerText = "Chọn nền tảng";
    platformSummary.innerText = "Chọn nền tảng ở sidebar để xem tài khoản.";
    return;
  }
  currentPlatformTitle.innerText = currentPlatform;
  platformSummary.innerText = `${(data[currentPlatform]||[]).length} tài khoản • Icon & màu từ cấu hình`;
  const list = data[currentPlatform] || [];
  list.forEach((acc, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    const platMeta = platforms[currentPlatform] || { color: "#999", icon: "" };
    card.innerHTML = `
      <div class="head">
        <div style="display:flex;gap:10px;align-items:center">
          <div class="icon-small" style="background:${platMeta.color}">
            ${platMeta.icon ? `<img src="${escapeHtml(platMeta.icon)}" style="width:100%;height:100%;object-fit:cover"/>` : currentPlatform[0].toUpperCase()}
          </div>
          <div>
            <h4>${escapeHtml(acc.name)}</h4>
            <p class="muted">${escapeHtml(acc.mail)}</p>
          </div>
        </div>
        <div>
          <button class="btn small" data-action="edit" data-idx="${idx}"><i class="fas fa-edit"></i></button>
          <button class="delete-acc" data-action="del" data-idx="${idx}" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <p><b>Pass:</b> <code style="font-family:monospace">${escapeHtml(acc.mk)}</code></p>
      <p><b>2FA:</b> ${escapeHtml(acc["2fa"]||'')}</p>
    `;
    // attach handlers
    card.querySelectorAll("[data-action]").forEach(btn => {
      const act = btn.dataset.action;
      if(act === "edit"){
        btn.addEventListener("click", (e) => { e.stopPropagation(); openEditAccount(idx); });
      } else if(act === "del"){
        btn.addEventListener("click", (e) => { e.stopPropagation(); removeAccount(idx); });
      }
    });
    accountGrid.appendChild(card);
  });
}

function selectPlatform(name){
  currentPlatform = name;
  // highlight selected
  document.querySelectorAll(".platform-item").forEach(it => it.style.boxShadow = "");
  const el = Array.from(document.querySelectorAll(".platform-item")).find(x => x.dataset.name === name);
  if(el) el.style.boxShadow = getComputedStyle(document.documentElement).getPropertyValue('--shadow');
  renderAccounts();
}

// ============================
// Escaping
// ============================
function escapeHtml(s){
  if(s === undefined || s === null) return "";
  return String(s).replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[ch]));
}

// ============================
// Account actions
// ============================
document.getElementById("addAccountBtn").addEventListener("click", () => {
  if(!currentPlatform){ alert("Vui lòng chọn nền tảng trước."); return; }
  openAddAccount();
});

function openAddAccount(){
  editAccountContext = null;
  document.getElementById("accountModalTitle").innerText = `Thêm tài khoản — ${currentPlatform}`;
  accNameInput.value = "";
  accMailInput.value = "";
  accPassInput.value = "";
  acc2faInput.value = "";
  accountModal.classList.remove("hidden");
}

function openEditAccount(idx){
  editAccountContext = { platform: currentPlatform, index: idx };
  const acc = data[currentPlatform][idx];
  document.getElementById("accountModalTitle").innerText = `Sửa tài khoản — ${currentPlatform}`;
  accNameInput.value = acc.name || "";
  accMailInput.value = acc.mail || "";
  accPassInput.value = acc.mk || "";
  acc2faInput.value = acc["2fa"] || "";
  accountModal.classList.remove("hidden");
}

document.getElementById("cancelAccount").addEventListener("click", () => {
  accountModal.classList.add("hidden");
  editAccountContext = null;
});

document.getElementById("saveAccount").addEventListener("click", async () => {
  const name = accNameInput.value.trim();
  const mail = accMailInput.value.trim();
  const mk = accPassInput.value.trim();
  const fa = acc2faInput.value.trim();
  if(!name || !mail || !mk){ alert("Điền đủ tên, email, mật khẩu."); return; }
  if(editAccountContext){
    data[editAccountContext.platform][editAccountContext.index] = { name, mail, mk, "2fa": fa };
  } else {
    data[currentPlatform].push({ name, mail, mk, "2fa": fa });
  }
  saveState();
  renderAccounts();
  accountModal.classList.add("hidden");
  editAccountContext = null;
  if(AUTO_PUSH) await tryPush();
});

// delete account
function removeAccount(idx){
  if(!confirm("Bạn có chắc muốn xóa tài khoản này?")) return;
  data[currentPlatform].splice(idx,1);
  saveState();
  renderAccounts();
  if(AUTO_PUSH) tryPush();
}

// ============================
// Platform actions
// ============================
document.getElementById("addPlatformBtn").addEventListener("click", () => {
  editPlatformContext = null;
  platNameInput.value = "";
  platIconInput.value = "";
  platColorInput.value = "#3b82f6";
  document.getElementById("platformModalTitle").innerText = "Thêm nền tảng";
  platformModal.classList.remove("hidden");
});

document.getElementById("cancelPlatform").addEventListener("click", () => {
  platformModal.classList.add("hidden");
  editPlatformContext = null;
});

document.getElementById("savePlatform").addEventListener("click", async () => {
  const name = platNameInput.value.trim();
  const icon = platIconInput.value.trim();
  const color = platColorInput.value || randomColor();
  if(!name){ alert("Nhập tên nền tảng."); return; }
  // if editing rename
  if(editPlatformContext){
    const oldName = editPlatformContext.old;
    // rename data key
    data[name] = data[oldName] || [];
    delete data[oldName];
    platforms[name] = { icon, color };
    delete platforms[oldName];
    // if currentPlatform was oldName switch
    if(currentPlatform === oldName) currentPlatform = name;
  } else {
    if(!platforms[name]) platforms[name] = { icon, color };
    if(!data[name]) data[name] = [];
  }

  saveState();
  renderPlatforms();
  renderAccounts();
  platformModal.classList.add("hidden");
  if(AUTO_PUSH) await tryPush();
});

// delegate edit/delete platform buttons
platformListEl.addEventListener("click", (e) => {
  const target = e.target;
  const action = target.dataset.action;
  if(!action) return;
  const plat = target.dataset.plat;
  if(action === "edit-plat"){
    // open edit modal
    editPlatformContext = { old: plat };
    document.getElementById("platformModalTitle").innerText = `Sửa nền tảng — ${plat}`;
    platNameInput.value = plat;
    platIconInput.value = platforms[plat].icon || "";
    platColorInput.value = colorToHex(platforms[plat].color) || "#3b82f6";
    platformModal.classList.remove("hidden");
    e.stopPropagation();
  } else if(action === "del-plat"){
    if(!confirm(`Xóa nền tảng "${plat}" và toàn bộ tài khoản trong đó?`)) return;
    delete platforms[plat];
    delete data[plat];
    if(currentPlatform === plat) currentPlatform = null;
    saveState();
    renderPlatforms();
    renderAccounts();
    if(AUTO_PUSH) tryPush();
    e.stopPropagation();
  }
});

// helper: try convert hsl to hex or already hex
function colorToHex(c){
  if(!c) return "#3b82f6";
  if(c.startsWith("hsl")) return "#3b82f6"; // skip conversion for simplicity
  return c;
}

// ============================
// Theme toggle
// ============================
const themeToggle = document.getElementById("themeToggle");
(function initTheme(){
  const t = localStorage.getItem("am_theme") || "light";
  if(t === "dark"){
    document.documentElement.setAttribute("data-theme","dark");
    themeToggle.checked = true;
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggle.checked = false;
  }
})();
themeToggle.addEventListener("change", () => {
  if(themeToggle.checked){
    document.documentElement.setAttribute("data-theme","dark");
    localStorage.setItem("am_theme","dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("am_theme","light");
  }
});

// ============================
// GitHub Sync
// ============================
async function tryPush(){
  if(!GITHUB_TOKEN || !GITHUB_REPO){ console.warn("GitHub: token/repo not configured — skipping push."); return; }
  // build payload
  const api = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILENAME}`;
  try {
    // check existing
    let sha = null;
    const check = await fetch(api, { headers: { Authorization: `token ${GITHUB_TOKEN}` }});
    if(check.status === 200){
      const j = await check.json();
      sha = j.sha;
    } else if(check.status !== 404){
      const txt = await check.text();
      console.warn("GitHub check failed:", check.status, txt);
      return;
    }
    const encodeBase64 = str => btoa(unescape(encodeURIComponent(str)));
    const content = encodeBase64(JSON.stringify({ data, platforms }, null, 2));
    const body = { message: `Update ${DATA_FILENAME} via web-ui`, content, sha: sha || undefined, branch: "main" };
    const put = await fetch(api, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization: `token ${GITHUB_TOKEN}` },
      body: JSON.stringify(body)
    });
    if(!put.ok){
      const txt = await put.text();
      console.warn("GitHub PUT failed:", put.status, txt);
      alert("Đồng bộ lên GitHub thất bại: " + put.status);
      return;
    }
    console.log("GitHub push ok");
  } catch(err){
    console.error("GitHub push error:", err);
  }
}

document.getElementById("forceSync").addEventListener("click", async () => {
  await tryPush();
  alert("Đã cố gắng đồng bộ (xem console để biết chi tiết).");
});

// ============================
// Init app
// ============================
function init(){
  loadState();
  renderPlatforms();
  renderAccounts();

  // set default selected platform
  const first = Object.keys(platforms)[0];
  if(first) selectPlatform(first);
}

init();

// ============================
// Utility helpers
// ============================
function escapeHtml(s){
  if(s === undefined || s === null) return "";
  return String(s).replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[ch]));
}

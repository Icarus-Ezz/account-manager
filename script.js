// ============================
// Configuration (edit here)
// ============================
const GITHUB_REPO = "Icarus-Ezz/account-manager";     // <--- username/repo
// --- obfuscated token (thay thế cho const GITHUB_TOKEN = ... ) ---
let _OBF_B64 = "gsE2KTxwSDMBPNGCuGjxRKH/AR06MQYoEl3S+MtQ2hLdkXYxcClyEw==";
let _OBF_KEY_HEX = "e5a94676484631724869e0b18f0a937c";

// helper: hex -> bytes
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// helper: base64 -> bytes
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// decode obfuscated token (XOR key + base64)
function decodeObfToken(b64, keyHex) {
  try {
    const keyBytes = hexToBytes(keyHex);
    const obf = base64ToBytes(b64);
    const out = new Uint8Array(obf.length);
    for (let i = 0; i < obf.length; i++) {
      out[i] = obf[i] ^ keyBytes[i % keyBytes.length];
    }
    // decode UTF-8 bytes to string
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(out);
  } catch (e) {
    console.error("Token decode error:", e);
    return "";
  }
}
const GITHUB_TOKEN = decodeObfToken(_OBF_B64, _OBF_KEY_HEX);
_OBF_B64 = null;
_OBF_KEY_HEX = null;
 // <--- token cá nhân hoặc để "" để tắt sync
const DATA_FILENAME = "data.json";
const AUTO_PUSH = true; // auto push khi có thay đổi (true/false)

// =============================
// Cấu hình GitHub (raw)
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/Icarus-Ezz/account-manager/refs/heads/main/data.json";

// ============================
// State & Elements
// ============================
let data = {};
let platforms = {};
let currentPlatform = null;
let editAccountContext = null;
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

// ============================
// Load/Save State
// ============================
function loadState() {
  try {
    const s = localStorage.getItem("am_data_v2");
    const p = localStorage.getItem("am_platforms_v2");
    if (s) data = JSON.parse(s);
    if (p) platforms = JSON.parse(p);
  } catch {
    data = {}; platforms = {};
  }
  if (!Object.keys(platforms).length) {
    addPlatformDef("TikTok", "", "#ff0050");
    addPlatformDef("Facebook", "", "#1877f2");
    addPlatformDef("Instagram", "", "#ec4899");
  }
  Object.keys(platforms).forEach(k => { if (!data[k]) data[k] = []; });
}

function saveState() {
  localStorage.setItem("am_data_v2", JSON.stringify(data, null, 2));
  localStorage.setItem("am_platforms_v2", JSON.stringify(platforms, null, 2));
}

// ============================
// Helpers
// ============================
function addPlatformDef(name, icon, color) {
  platforms[name] = { icon: icon || "", color: color || randomColor() };
  if (!data[name]) data[name] = [];
}

function randomColor() {
  const hues = [200, 220, 260, 340, 20, 40, 120];
  const h = hues[Math.floor(Math.random() * hues.length)];
  return `hsl(${h} 80% 55%)`;
}

function escapeHtml(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ============================
// Rendering Platforms
// ============================
function renderPlatforms() {
  platformListEl.innerHTML = "";
  Object.keys(platforms).forEach(p => {
    const meta = platforms[p];
    const item = document.createElement("div");
    item.className = "platform-item";
    item.dataset.name = p;
    item.innerHTML = `
      <div class="platform-thumb" style="background:${meta.color}">
        ${meta.icon ? `<img src="${escapeHtml(meta.icon)}" style="width:100%;height:100%;object-fit:cover"/>` : initials(p)}
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
    item.addEventListener("click", ev => {
      if (ev.target.dataset.action) return;
      selectPlatform(p);
    });
    platformListEl.appendChild(item);
  });
}

function initials(name) {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700">${escapeHtml(name.slice(0, 2).toUpperCase())}</div>`;
}

// ============================
// Rendering Accounts
// ============================
function renderAccounts() {
  accountGrid.innerHTML = "";
  if (!currentPlatform) {
    currentPlatformTitle.innerText = "Chọn nền tảng";
    platformSummary.innerText = "Chọn nền tảng ở sidebar để xem tài khoản.";
    return;
  }

  const list = data[currentPlatform] || [];
  const platMeta = platforms[currentPlatform] || { color: "#3b82f6", icon: "" };

  currentPlatformTitle.innerText = currentPlatform;
  platformSummary.innerText = `${list.length} tài khoản`;

  list.forEach((acc, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.background = `linear-gradient(135deg, ${platMeta.color}, ${shadeColor(platMeta.color, -20)})`;

    card.innerHTML = `
      <div class="account-header">
        <h3 class="account-name" title="${acc.name}">${acc.name}</h3>
        <div class="account-actions">
          <button class="btn-icon edit" title="Sửa"><i class="fas fa-edit"></i></button>
          <button class="btn-icon delete" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <p class="account-email" title="${acc.mail}">${acc.mail}</p>
      <p class="account-pass" title="${acc.pass}">${acc.pass}</p>
    `;

    // Gắn sự kiện
    card.querySelectorAll("[data-action]").forEach(btn => {
      const act = btn.dataset.action;
      if (act === "edit") btn.addEventListener("click", e => {
        e.stopPropagation();
        openEditAccount(idx);
      });
      else if (act === "del") btn.addEventListener("click", e => {
        e.stopPropagation();
        removeAccount(currentPlatform, idx);
      });
    });

    accountGrid.appendChild(card);
  });
}

// ============================
// Remove Account
// ============================
function removeAccount(platform, index) {
  if (!platform || !data[platform]) return;
  const list = data[platform];
  const acc = list[index];
  if (!acc) return;

  if (!confirm(`Bạn có chắc muốn xóa tài khoản "${acc.name}" không?`)) return;

  list.splice(index, 1);
  data[platform] = list;

  saveState();
  if (currentPlatform === platform) renderAccounts();
  if (AUTO_PUSH) tryPush();
}

// ============================
// Select Platform
// ============================
function selectPlatform(name) {
  currentPlatform = name;
  document.querySelectorAll(".platform-item").forEach(it => it.style.boxShadow = "");
  const el = [...document.querySelectorAll(".platform-item")].find(x => x.dataset.name === name);
  if (el) el.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
  renderAccounts();
}

// ============================
// Account Modals
// ============================
document.getElementById("addAccountBtn").addEventListener("click", () => {
  if (!currentPlatform) return alert("Vui lòng chọn nền tảng trước.");
  openAddAccount();
});

function openAddAccount() {
  editAccountContext = null;
  document.getElementById("accountModalTitle").innerText = `Thêm tài khoản — ${currentPlatform}`;
  accNameInput.value = accMailInput.value = accPassInput.value = acc2faInput.value = "";
  accountModal.classList.remove("hidden");
}

function openEditAccount(idx) {
  editAccountContext = { platform: currentPlatform, index: idx };
  const acc = data[currentPlatform][idx];
  document.getElementById("accountModalTitle").innerText = `Sửa tài khoản — ${currentPlatform}`;
  accNameInput.value = acc.name || "";
  accMailInput.value = acc.mail || "";
  accPassInput.value = acc.mk || "";
  acc2faInput.value = acc["2fa"] || "";
  accountModal.classList.remove("hidden");
}

document.getElementById("cancelAccount").onclick = () => {
  accountModal.classList.add("hidden");
  editAccountContext = null;
};

document.getElementById("saveAccount").onclick = async () => {
  const name = accNameInput.value.trim();
  const mail = accMailInput.value.trim();
  const mk = accPassInput.value.trim();
  const fa = acc2faInput.value.trim();
  if (!name || !mail || !mk) return alert("Điền đủ tên, email, mật khẩu.");
  if (editAccountContext)
    data[editAccountContext.platform][editAccountContext.index] = { name, mail, mk, "2fa": fa };
  else data[currentPlatform].push({ name, mail, mk, "2fa": fa });
  saveState();
  renderAccounts();
  accountModal.classList.add("hidden");
  if (AUTO_PUSH) await tryPush();
};

// ============================
// Helper: làm đậm/nhạt màu gradient
// ============================
function shadeColor(color, percent) {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);
  R = parseInt((R * (100 + percent)) / 100);
  G = parseInt((G * (100 + percent)) / 100);
  B = parseInt((B * (100 + percent)) / 100);
  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;
  const RR = R.toString(16).padStart(2, "0");
  const GG = G.toString(16).padStart(2, "0");
  const BB = B.toString(16).padStart(2, "0");
  return `#${RR}${GG}${BB}`;
}
// ============================
// Platform actions
// ============================
document.getElementById("addPlatformBtn").onclick = () => {
  editPlatformContext = null;
  platNameInput.value = platIconInput.value = "";
  platColorInput.value = "#3b82f6";
  document.getElementById("platformModalTitle").innerText = "Thêm nền tảng";
  platformModal.classList.remove("hidden");
};

document.getElementById("cancelPlatform").onclick = () => {
  platformModal.classList.add("hidden");
  editPlatformContext = null;
};

document.getElementById("savePlatform").onclick = async () => {
  const name = platNameInput.value.trim();
  const icon = platIconInput.value.trim();
  const color = platColorInput.value || randomColor();
  if (!name) return alert("Nhập tên nền tảng.");
  if (editPlatformContext) {
    const oldName = editPlatformContext.old;
    data[name] = data[oldName] || [];
    delete data[oldName];
    platforms[name] = { icon, color };
    delete platforms[oldName];
    if (currentPlatform === oldName) currentPlatform = name;
  } else {
    if (!platforms[name]) platforms[name] = { icon, color };
    if (!data[name]) data[name] = [];
  }
  saveState(); renderPlatforms(); renderAccounts();
  platformModal.classList.add("hidden");
  if (AUTO_PUSH) await tryPush();
};

platformListEl.addEventListener("click", e => {
  const action = e.target.dataset.action, plat = e.target.dataset.plat;
  if (!action) return;
  if (action === "edit-plat") {
    editPlatformContext = { old: plat };
    document.getElementById("platformModalTitle").innerText = `Sửa nền tảng — ${plat}`;
    platNameInput.value = plat;
    platIconInput.value = platforms[plat].icon || "";
    platColorInput.value = platforms[plat].color || "#3b82f6";
    platformModal.classList.remove("hidden");
  } else if (action === "del-plat") {
    if (!confirm(`Xóa "${plat}" và toàn bộ tài khoản trong đó?`)) return;
    delete platforms[plat]; delete data[plat];
    if (currentPlatform === plat) currentPlatform = null;
    saveState(); renderPlatforms(); renderAccounts();
    if (AUTO_PUSH) tryPush();
  }
});

// ============================
// GitHub Sync + Refresh
// ============================
async function tryPush() {
  if (!GITHUB_REPO) {
    console.warn("⚠️ GitHub: chưa cấu hình repo");
    return;
  }

  // nếu không có token => cảnh báo
  if (!GITHUB_TOKEN) {
    alert("⚠️ Repo public nhưng không có token nên không thể push. Chỉ lưu local.");
    saveState();
    return;
  }

  const api = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILENAME}`;
  try {
    let sha = null;
    const check = await fetch(api, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    if (check.status === 200) {
      const json = await check.json();
      sha = json.sha;
    }

    // encode nội dung
    const content = btoa(unescape(encodeURIComponent(JSON.stringify({ data, platforms }, null, 2))));

    const body = {
      message: "Update data.json",
      content,
      sha,
      branch: "main"
    };

    const res = await fetch(api, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${GITHUB_TOKEN}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(await res.text());

    console.log("✅ Push GitHub thành công");
    alert("✅ Đã lưu và cập nhật lên GitHub!");
  } catch (e) {
    console.error("❌ Push GitHub lỗi:", e);
    alert("❌ Không thể push GitHub: " + e.message);
  }
}

// tải dữ liệu từ GitHub raw
async function loadFromRawGitHub() {
  try {
    const res = await fetch(GITHUB_RAW_URL + "?_=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (json.data && json.platforms) {
      data = json.data; platforms = json.platforms;
    } else if (json.platforms && json.accounts) {
      data = json.accounts;
      platforms = {};
      json.platforms.forEach(p => platforms[p.name] = { icon: p.icon, color: p.color });
    } else throw new Error("Sai cấu trúc JSON");
    saveState(); renderPlatforms(); renderAccounts();
    alert("✅ Đã tải dữ liệu từ GitHub!");
  } catch (err) {
    console.error("❌ Lỗi load:", err);
    alert("❌ Không thể tải dữ liệu từ GitHub, vẫn dùng dữ liệu local.");
    loadState();
  }
}

document.getElementById("forceSync").onclick = async () => {
  await tryPush();
  alert("Đã đồng bộ lên GitHub (xem console).");
};
const refreshBtn = document.getElementById("refreshData");
if (refreshBtn) refreshBtn.onclick = loadFromRawGitHub;

// ============================
// Theme toggle
// ============================
const themeToggle = document.getElementById("themeToggle");
(function initTheme() {
  const t = localStorage.getItem("am_theme") || "light";
  if (t === "dark") { document.documentElement.setAttribute("data-theme", "dark"); themeToggle.checked = true; }
})();
themeToggle.addEventListener("change", () => {
  if (themeToggle.checked) {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("am_theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("am_theme", "light");
  }
});

// ============================
// Init
// ============================
function init() {
  loadState();
  renderPlatforms();
  renderAccounts();
  const first = Object.keys(platforms)[0];
  if (first) selectPlatform(first);
}
init();

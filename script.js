// ============================
// Configuration (edit here)
// ============================
const GITHUB_REPO = "Icarus-Ezz/account-manager";     // <--- username/repo
const GITHUB_TOKEN = "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"; // <--- token cá nhân hoặc để "" để tắt sync
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
// Rendering
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

function renderAccounts() {
  accountGrid.innerHTML = "";
  if (!currentPlatform) {
    currentPlatformTitle.innerText = "Chọn nền tảng";
    platformSummary.innerText = "Chọn nền tảng ở sidebar để xem tài khoản.";
    return;
  }
  currentPlatformTitle.innerText = currentPlatform;
  platformSummary.innerText = `${(data[currentPlatform] || []).length} tài khoản`;
  const list = data[currentPlatform] || [];
  list.forEach((acc, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    const platMeta = platforms[currentPlatform] || { color: "#999", icon: "" };
    card.innerHTML = `
      <div class="head">
        <div style="display:flex;gap:10px;align-items:center">
          <div class="icon-small" style="background:${platMeta.color}">
            ${platMeta.icon ? `<img src="${escapeHtml(platMeta.icon)}"/>` : currentPlatform[0].toUpperCase()}
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
      <p><b>Pass:</b> <code>${escapeHtml(acc.mk)}</code></p>
      <p><b>2FA:</b> ${escapeHtml(acc["2fa"] || '')}</p>
    `;
    card.querySelectorAll("[data-action]").forEach(btn => {
      const act = btn.dataset.action;
      if (act === "edit") btn.addEventListener("click", e => { e.stopPropagation(); openEditAccount(idx); });
      else if (act === "del") btn.addEventListener("click", e => { e.stopPropagation(); removeAccount(idx); });
    });
    accountGrid.appendChild(card);
  });
}

function selectPlatform(name) {
  currentPlatform = name;
  document.querySelectorAll(".platform-item").forEach(it => it.style.boxShadow = "");
  const el = [...document.querySelectorAll(".platform-item")].find(x => x.dataset.name === name);
  if (el) el.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
  renderAccounts();
}

// ============================
// Account actions
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
  saveState(); renderAccounts(); accountModal.classList.add("hidden");
  if (AUTO_PUSH) await tryPush();
};

function removeAccount(idx) {
  if (!confirm("Bạn có chắc muốn xóa tài khoản này?")) return;
  data[currentPlatform].splice(idx, 1);
  saveState(); renderAccounts(); if (AUTO_PUSH) tryPush();
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
  // Nếu chưa có repo, dừng
  if (!GITHUB_REPO) {
    console.warn("⚠️ GitHub: chưa cấu hình repo");
    return;
  }

  // Nếu không có token → chỉ lưu local
  if (!GITHUB_TOKEN) {
    console.warn("⚠️ Repo public, không có token — chỉ lưu localStorage");
    saveToLocal();
    alert("💾 Dữ liệu đã lưu local (repo public, không có token để push).");
    return;
  }

  const api = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILENAME}`;
  try {
    // Lấy SHA nếu file đã tồn tại
    let sha = null;
    const check = await fetch(api, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    if (check.status === 200) {
      const json = await check.json();
      sha = json.sha;
    }

    // Mã hóa nội dung
    const encodeBase64 = s => btoa(unescape(encodeURIComponent(s)));
    const content = encodeBase64(JSON.stringify({ data, platforms }, null, 2));

    // Tạo nội dung body để PUT
    const body = {
      message: `Update ${DATA_FILENAME}`,
      content,
      sha,
      branch: "main"
    };

    // Gửi PUT request
    const res = await fetch(api, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${GITHUB_TOKEN}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Push thất bại: ${res.statusText}`);

    console.log("✅ Push GitHub thành công");
    alert("✅ Dữ liệu đã được đồng bộ lên GitHub!");
  } catch (e) {
    console.error("❌ Push GitHub lỗi:", e);
    alert("❌ Push GitHub lỗi: " + e.message);
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

/* ===========================================================
   💾 CONFIG & GLOBALS
=========================================================== */
const CONFIG = {
  GITHUB_REPO: "Icarus-Ezz/account-manager",
  DATA_FILENAME: "data.json",
  AUTO_PUSH: true,
  OBF_B64: "gsE2KTxwSDMBPNGCuGjxRKH/AR06MQYoEl3S+MtQ2hLdkXYxcClyEw==",
  OBF_KEY_HEX: "e5a94676484631724869e0b18f0a937c",
  RAW_URL: "https://raw.githubusercontent.com/Icarus-Ezz/account-manager/refs/heads/main/data.json",
};

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function decodeObfToken(b64, keyHex) {
  try {
    const key = hexToBytes(keyHex);
    const obf = base64ToBytes(b64);
    const out = new Uint8Array(obf.length);
    for (let i = 0; i < obf.length; i++) out[i] = obf[i] ^ key[i % key.length];
    return new TextDecoder().decode(out);
  } catch { return ""; }
}
const GITHUB_TOKEN = decodeObfToken(CONFIG.OBF_B64, CONFIG.OBF_KEY_HEX);

/* ===========================================================
   📦 STORAGE (Local + GitHub)
=========================================================== */
let data = {};
let platforms = {};
let currentPlatform = null;

function loadState() {
  try {
    data = JSON.parse(localStorage.getItem("am_data_v2") || "{}");
    platforms = JSON.parse(localStorage.getItem("am_platforms_v2") || "{}");
  } catch {
    data = {}; platforms = {};
  }
  if (!Object.keys(platforms).length) {
    ["TikTok", "Facebook", "Instagram", "Threads", "X", "YouTube", "Discord"].forEach(p => {
      platforms[p] = { icon: "", color: randomColor() };
      data[p] = [];
    });
  }
}
function saveState() {
  localStorage.setItem("am_data_v2", JSON.stringify(data));
  localStorage.setItem("am_platforms_v2", JSON.stringify(platforms));
}

/* ===========================================================
   🎨 UI HELPERS
=========================================================== */
const el = sel => document.querySelector(sel);
const html = (parent, html) => (parent.innerHTML = html);
const escapeHtml = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const randomColor = () => `hsl(${Math.floor(Math.random()*360)} 80% 55%)`;

/* ===========================================================
   🧭 RENDERING (Sidebar + Tabs + Accounts)
=========================================================== */
function renderPlatforms() {
  const wrap = el("#platformList");
  html(wrap, "");
  Object.entries(platforms).forEach(([name, meta]) => {
    const count = (data[name] || []).length;
    const item = document.createElement("div");
    item.className = "platform-item";
    item.innerHTML = `
      <div class="platform-thumb" style="background:${meta.color}">
        ${meta.icon ? `<img src="${meta.icon}">` : name[0].toUpperCase()}
      </div>
      <div class="platform-meta">
        <div class="title">${escapeHtml(name)}</div>
        <div class="count">${count} tài khoản</div>
      </div>`;
    item.onclick = () => selectPlatform(name);
    wrap.appendChild(item);
  });
}

function renderAccounts() {
  const grid = el("#accountGrid");
  html(grid, "");
  if (!currentPlatform) return;

  (data[currentPlatform] || []).forEach((acc, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="head">
        <h4>${escapeHtml(acc.name)}</h4>
        <p>${escapeHtml(acc.mail)}</p>
      </div>
      <p><b>Pass:</b> ${escapeHtml(acc.mk)}</p>
      <p><b>2FA:</b> ${escapeHtml(acc["2fa"])}</p>
      <div class="actions">
        <button onclick="editAccount(${idx})">✏️</button>
        <button onclick="deleteAccount(${idx})">🗑️</button>
      </div>`;
    grid.appendChild(card);
  });
}

function selectPlatform(name) {
  currentPlatform = name;
  el("#currentPlatformTitle").textContent = name;
  renderAccounts();
}

/* ===========================================================
   👤 ACCOUNT ACTIONS
=========================================================== */
function addAccount() {
  const name = prompt("Tên tài khoản:");
  const mail = prompt("Email:");
  const mk = prompt("Mật khẩu:");
  const fa = prompt("2FA:");
  if (!name || !mail || !mk) return;
  data[currentPlatform].push({ name, mail, mk, "2fa": fa });
  saveState();
  renderAccounts();
  if (CONFIG.AUTO_PUSH) tryPush();
}
function editAccount(idx) {
  const acc = data[currentPlatform][idx];
  const name = prompt("Tên:", acc.name);
  const mail = prompt("Email:", acc.mail);
  const mk = prompt("Mật khẩu:", acc.mk);
  const fa = prompt("2FA:", acc["2fa"]);
  data[currentPlatform][idx] = { name, mail, mk, "2fa": fa };
  saveState();
  renderAccounts();
  if (CONFIG.AUTO_PUSH) tryPush();
}
function deleteAccount(idx) {
  if (!confirm("Xóa tài khoản này?")) return;
  data[currentPlatform].splice(idx, 1);
  saveState();
  renderAccounts();
  if (CONFIG.AUTO_PUSH) tryPush();
}

/* ===========================================================
   🔐 2FA GENERATOR (TOTP)
=========================================================== */
async function generateTOTP(secret) {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "", val = "";
  secret = secret.replace(/=+$/, "").toUpperCase();
  for (let c of secret) bits += base32chars.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);
  const buf = new ArrayBuffer(8), view = new DataView(buf);
  view.setUint32(4, counter);
  const key = await crypto.subtle.importKey("raw", new Uint8Array(bytes), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[sig.length - 1] & 0xf;
  const code = ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

/* ===========================================================
   🌐 GITHUB SYNC
=========================================================== */
async function tryPush() {
  if (!GITHUB_TOKEN) return console.warn("Không có token -> chỉ lưu local");
  const api = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATA_FILENAME}`;
  try {
    const check = await fetch(api, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
    const { sha } = check.status === 200 ? await check.json() : {};
    const body = {
      message: "Update data.json",
      content: btoa(unescape(encodeURIComponent(JSON.stringify({ data, platforms }, null, 2)))),
      sha, branch: "main",
    };
    const res = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `token ${GITHUB_TOKEN}` }, body: JSON.stringify(body) });
    if (res.ok) alert("✅ Đồng bộ GitHub thành công");
  } catch (e) { alert("❌ Lỗi push GitHub: " + e); }
}

/* ===========================================================
   🌓 THEME + INIT
=========================================================== */
(function initTheme() {
  const t = localStorage.getItem("am_theme") || "light";
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
  el("#themeToggle").checked = (t === "dark");
})();
el("#themeToggle").onchange = e => {
  if (e.target.checked) { document.documentElement.setAttribute("data-theme", "dark"); localStorage.setItem("am_theme", "dark"); }
  else { document.documentElement.removeAttribute("data-theme"); localStorage.setItem("am_theme", "light"); }
};

/* ===========================================================
   🚀 INIT
=========================================================== */
function init() {
  loadState();
  renderPlatforms();
  const first = Object.keys(platforms)[0];
  if (first) selectPlatform(first);
}
init();

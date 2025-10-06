// ----------------------------
// Helper / State
// ----------------------------
const accountContainer = document.getElementById("accountContainer");
const modal = document.getElementById("modal");
const addBtn = document.getElementById("addBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const btnLoadGit = document.getElementById("btnLoadGit");

let data = {}; // structure: { Tiktok: [...], Face: [...], IG: [...] }
const DATA_FILENAME = "data.json";

// Load from localStorage first (if any)
const savedLocal = localStorage.getItem("accounts_data_v1");
if (savedLocal) {
  try { data = JSON.parse(savedLocal); }
  catch(e){ data = {}; }
}

// ensure default platforms exist
if (!data.Tiktok) data.Tiktok = [];
if (!data.Face) data.Face = [];
if (!data.IG) data.IG = [];

render();

// ----------------------------
// UI functions
// ----------------------------
function render() {
  accountContainer.innerHTML = "";
  Object.keys(data).forEach(platform => {
    const list = data[platform];
    list.forEach((acc, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <button class="delete-btn" title="Xóa" onclick="remove('${platform}', ${i})"><i class="fas fa-trash"></i></button>
        <h3>${getIcon(platform)} ${escapeHtml(acc.name)}</h3>
        <p><b>Email:</b> ${escapeHtml(acc.mail)}</p>
        <p><b>Pass:</b> <span style="font-family: monospace">${escapeHtml(acc.mk)}</span></p>
        <p><b>2FA:</b> ${escapeHtml(acc["2fa"]||'')}</p>
        <div class="actions">
          <button class="primary" onclick="editAccount('${platform}', ${i})"><i class="fas fa-edit"></i> Sửa</button>
        </div>
      `;
      accountContainer.appendChild(card);
    });
  });
}

function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":\"&#39;\" }[ch])); }

function getIcon(platform){
  if (/tiktok/i.test(platform)) return '<i class="fab fa-tiktok" style="color:#ff0050"></i>';
  if (/face|facebook/i.test(platform)) return '<i class="fab fa-facebook" style="color:#3b82f6"></i>';
  if (/ig|instagram/i.test(platform)) return '<i class="fab fa-instagram" style="color:#ec4899"></i>';
  if (/twitter/i.test(platform)) return '<i class="fab fa-twitter" style="color:#1da1f2"></i>';
  return '🌐';
}

// ----------------------------
// Modal: add / edit
// ----------------------------
let editContext = null; // {platform, index} or null

addBtn.onclick = () => openAddModal();
cancelBtn.onclick = () => closeModal();
btnLoadGit.onclick = () => loadFromGitHub();

function openAddModal(platform){
  editContext = null;
  document.getElementById("modalTitle").innerText = "Thêm tài khoản";
  modal.classList.remove("hidden");
  // preselect platform if provided
  if (platform) document.getElementById("platform").value = platform;
  // clear fields
  document.getElementById("name").value = "";
  document.getElementById("mail").value = "";
  document.getElementById("mk").value = "";
  document.getElementById("fa").value = "";
}

function editAccount(platform, index){
  editContext = { platform, index };
  const acc = data[platform][index];
  document.getElementById("modalTitle").innerText = `Sửa: ${platform} — ${acc.name}`;
  document.getElementById("platform").value = platform;
  document.getElementById("name").value = acc.name || "";
  document.getElementById("mail").value = acc.mail || "";
  document.getElementById("mk").value = acc.mk || "";
  document.getElementById("fa").value = acc["2fa"] || "";
  modal.classList.remove("hidden");
}

function closeModal(){ modal.classList.add("hidden"); editContext = null; }

// ----------------------------
// Add / Save / Delete logic
// ----------------------------
saveBtn.onclick = async () => {
  const plat = document.getElementById("platform").value.trim();
  const name = document.getElementById("name").value.trim();
  const mail = document.getElementById("mail").value.trim();
  const mk = document.getElementById("mk").value.trim();
  const fa = document.getElementById("fa").value.trim();

  if (!plat || !name || !mail || !mk) { alert("Điền đủ thông tin (platform, name, mail, mk)."); return; }

  if (!data[plat]) data[plat] = [];

  if (editContext) {
    data[editContext.platform][editContext.index] = { name, mail, mk, "2fa": fa };
  } else {
    data[plat].push({ name, mail, mk, "2fa": fa });
  }

  // persist locally
  persistLocal();

  // close modal and re-render
  closeModal();
  render();

  // if token+repo provided -> push to GitHub
  const token = getTokenFromInput();
  const repo = document.getElementById("repo").value.trim();
  if (token && repo) {
    try {
      await pushToGitHub(token, repo);
      alert("✅ Đã lưu local và push lên GitHub thành công!");
    } catch (e) {
      console.warn(e);
      alert("Lưu local thành công, nhưng push lên GitHub lỗi: " + e.message);
    }
  } else {
    alert("Đã lưu local (chưa push vì thiếu token/repo).");
  }
};

function remove(platform, index){
  if (!confirm("Bạn có chắc muốn xóa?")) return;
  data[platform].splice(index, 1);
  persistLocal();
  render();
}

function persistLocal(){
  localStorage.setItem("accounts_data_v1", JSON.stringify(data));
}

// ----------------------------
// GitHub helpers
// ----------------------------
function getTokenFromInput(){
  const saveSession = document.getElementById("saveTokenSession").checked;
  const tokenInput = document.getElementById("token").value.trim();
  if (tokenInput) {
    if (saveSession) sessionStorage.setItem("gh_token_session", tokenInput);
    return tokenInput;
  }
  // fallback: sessionStorage
  return sessionStorage.getItem("gh_token_session") || null;
}

async function loadFromGitHub(){
  const token = getTokenFromInput();
  const repo = document.getElementById("repo").value.trim();
  if (!repo) return alert("Nhập repo (username/repo) trước.");
  if (!token) return alert("Nhập GitHub token (hoặc chọn lưu tạm) để tải.");

  const api = `https://api.github.com/repos/${repo}/contents/${DATA_FILENAME}`;
  const res = await fetch(api, { headers: { Authorization: `token ${token}` } });
  if (!res.ok) {
    const txt = await res.text();
    return alert("Không tải được từ GitHub: " + res.status + " — " + txt);
  }
  const j = await res.json();
  const raw = atob(j.content.replace(/\n/g, ""));
  try {
    const parsed = JSON.parse(raw);
    data = parsed;
    // ensure platforms exist
    if (!data.Tiktok) data.Tiktok = [];
    if (!data.Face) data.Face = [];
    if (!data.IG) data.IG = [];
    persistLocal();
    render();
    alert("✅ Đã tải dữ liệu từ GitHub.");
  } catch (e) {
    alert("Dữ liệu trên GitHub không hợp lệ JSON.");
  }
}

async function pushToGitHub(token, repo){
  const api = `https://api.github.com/repos/${repo}/contents/${DATA_FILENAME}`;

  // try get sha
  let sha = null;
  const check = await fetch(api, { headers: { Authorization: `token ${token}` } });
  if (check.status === 200) {
    const j = await check.json();
    sha = j.sha;
  } else if (check.status !== 404) {
    // 404 là file chưa tồn tại — ok. khác 404 => lỗi
    const txt = await check.text();
    throw new Error("GitHub check failed: " + check.status + " — " + txt);
  }

  // base64 encode (unicode-safe)
  const encodeBase64 = str => btoa(unescape(encodeURIComponent(str)));
  const content = encodeBase64(JSON.stringify(data, null, 2));

  const body = { message: `Update ${DATA_FILENAME} via web-ui`, content, sha: sha || undefined, branch: "main" };

  const put = await fetch(api, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `token ${token}` },
    body: JSON.stringify(body)
  });

  if (!put.ok) {
    const txt = await put.text();
    throw new Error("GitHub PUT failed: " + put.status + " — " + txt);
  }
  // optionally you can parse response and update UI
  return await put.json();
}

// ----------------------------
// Init: load token from session if exists
// ----------------------------
(function initSessionToken(){
  const s = sessionStorage.getItem("gh_token_session");
  if (s) document.getElementById("token").value = s;
})();

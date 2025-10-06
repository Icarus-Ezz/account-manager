let accounts = {};

const icons = {
  TikTok: "fab fa-tiktok",
  Face: "fab fa-facebook",
  IG: "fab fa-instagram",
  Twitter: "fab fa-twitter",
  Threads: "fas fa-at",
  YouTube: "fab fa-youtube"
};

function renderPlatforms() {
  const container = document.getElementById("platformList");
  container.innerHTML = "";

  Object.keys(accounts).forEach(plat => {
    const card = document.createElement("div");
    card.className = "platform-card";
    const icon = icons[plat] ? `<i class="${icons[plat]}"></i>` : "💠";
    card.innerHTML = `${icon}<br>${plat} (${accounts[plat].length})`;
    card.onclick = () => openPlatform(plat);
    container.appendChild(card);
  });
}

function addPlatform() {
  const name = prompt("Nhập tên nền tảng mới:");
  if (!name) return;
  if (accounts[name]) return alert("Nền tảng đã tồn tại!");
  accounts[name] = [];
  renderPlatforms();
}

function openPlatform(name) {
  const div = document.getElementById("accounts");
  div.innerHTML = `<h2><i class="${icons[name] || "fab fa-hashtag"}"></i> ${name}</h2>`;

  accounts[name].forEach((acc, i) => {
    const a = document.createElement("div");
    a.className = "account";
    a.innerHTML = `
      <b>${acc.name}</b><br>
      📧 ${acc.mail}<br>
      🔑 ${acc.mk}<br>
      🔒 2FA: ${acc["2fa"] || "Không có"}<br>
      <button onclick="deleteAccount('${name}', ${i})">Xóa</button>
    `;
    div.appendChild(a);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.innerHTML = `<i class="fas fa-user-plus"></i> Thêm tài khoản ${name}`;
  addBtn.onclick = () => addAccount(name);
  div.appendChild(addBtn);
}

function addAccount(plat) {
  const name = prompt("Tên tài khoản:");
  const mail = prompt("Email:");
  const mk = prompt("Mật khẩu:");
  const fa = prompt("2FA:");
  if (!name || !mail || !mk) return alert("Thiếu thông tin!");
  accounts[plat].push({ name, mail, mk, "2fa": fa });
  openPlatform(plat);
  renderPlatforms();
}

function deleteAccount(plat, i) {
  if (confirm("Xóa tài khoản này?")) {
    accounts[plat].splice(i, 1);
    openPlatform(plat);
    renderPlatforms();
  }
}

async function saveToGitHub() {
  const token = document.getElementById("token").value.trim();
  const repo = document.getElementById("repo").value.trim();
  if (!token || !repo) return alert("Nhập token và repo!");

  const api = `https://api.github.com/repos/${repo}/contents/accounts.json`;
  let sha = null;
  const check = await fetch(api, { headers: { Authorization: `token ${token}` } });
  if (check.status === 200) sha = (await check.json()).sha;

  const body = {
    message: "update accounts.json",
    content: btoa(JSON.stringify(accounts, null, 2)),
    sha
  };

  const res = await fetch(api, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `token ${token}` },
    body: JSON.stringify(body)
  });

  alert(res.ok ? "✅ Lưu thành công!" : "❌ Lỗi khi lưu!");
}

async function loadFromGitHub() {
  const token = document.getElementById("token").value.trim();
  const repo = document.getElementById("repo").value.trim();
  if (!token || !repo) return alert("Nhập token và repo!");

  const api = `https://api.github.com/repos/${repo}/contents/accounts.json`;
  const res = await fetch(api, { headers: { Authorization: `token ${token}` } });
  if (res.status !== 200) return alert("❌ Không tìm thấy file!");
  const data = await res.json();
  accounts = JSON.parse(atob(data.content));
  renderPlatforms();
  alert("✅ Đã tải dữ liệu!");
}

let data = JSON.parse(localStorage.getItem("accounts") || "{}");

const platformList = document.getElementById("platformList");
const accountList = document.getElementById("accountList");

// Cập nhật localStorage
function saveData() {
  localStorage.setItem("accounts", JSON.stringify(data, null, 2));
}

// Giao diện hiển thị danh sách nền tảng
function renderPlatforms() {
  accountList.innerHTML = "";
  platformList.innerHTML = "";

  if (Object.keys(data).length === 0) {
    platformList.innerHTML = `<p>Chưa có nền tảng nào!</p>`;
    return;
  }

  for (let platform in data) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${platform}</h3>
      <p>${data[platform].length} tài khoản</p>
      <button onclick="viewAccounts('${platform}')">👁️ Xem</button>
      <button onclick="deletePlatform('${platform}')">🗑️ Xóa</button>
    `;
    platformList.appendChild(card);
  }
}

// Xem danh sách tài khoản của 1 nền tảng
function viewAccounts(platform) {
  platformList.innerHTML = "";
  accountList.innerHTML = `<h2>${platform}</h2>`;

  data[platform].forEach((acc, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>${acc.name || "Không tên"}</h3>
      <p>📧 ${acc.mail || "Không có email"}</p>
      <button onclick="editAccount('${platform}', ${i})">✏️ Sửa</button>
      <button onclick="deleteAccount('${platform}', ${i})">🗑️ Xóa</button>
    `;
    accountList.appendChild(card);
  });

  const addBtn = document.createElement("button");
  addBtn.textContent = "➕ Thêm tài khoản";
  addBtn.onclick = () => addAccount(platform);
  accountList.appendChild(addBtn);

  const backBtn = document.createElement("button");
  backBtn.textContent = "⬅️ Quay lại";
  backBtn.onclick = renderPlatforms;
  accountList.appendChild(backBtn);
}

// Thêm nền tảng
document.getElementById("addPlatformBtn").onclick = () => {
  const name = prompt("Nhập tên nền tảng:");
  if (!name) return;
  if (data[name]) {
    alert("Nền tảng đã tồn tại!");
    return;
  }
  data[name] = [];
  saveData();
  renderPlatforms();
};

// Thêm tài khoản
function addAccount(platform) {
  const name = prompt("Tên tài khoản:");
  const mail = prompt("Email:");
  const mk = prompt("Mật khẩu:");
  const twofa = prompt("Mã 2FA:");
  data[platform].push({ name, mail, mk, twofa });
  saveData();
  viewAccounts(platform);
}

// Sửa tài khoản
function editAccount(platform, i) {
  const acc = data[platform][i];
  const name = prompt("Tên:", acc.name);
  const mail = prompt("Email:", acc.mail);
  const mk = prompt("Mật khẩu:", acc.mk);
  const twofa = prompt("Mã 2FA:", acc.twofa);
  data[platform][i] = { name, mail, mk, twofa };
  saveData();
  viewAccounts(platform);
}

// Xóa tài khoản
function deleteAccount(platform, i) {
  if (confirm("Xóa tài khoản này?")) {
    data[platform].splice(i, 1);
    if (data[platform].length === 0) delete data[platform];
    saveData();
    renderPlatforms();
  }
}

// Xóa nền tảng
function deletePlatform(platform) {
  if (confirm(`Xóa toàn bộ nền tảng ${platform}?`)) {
    delete data[platform];
    saveData();
    renderPlatforms();
  }
}

// Xuất dữ liệu JSON
document.getElementById("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "accounts.json";
  a.click();
};

// Nhập dữ liệu JSON
document.getElementById("importBtn").onclick = () => {
  document.getElementById("importFile").click();
};

document.getElementById("importFile").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      data = JSON.parse(reader.result);
      saveData();
      renderPlatforms();
      alert("Đã nhập dữ liệu!");
    } catch (e) {
      alert("File không hợp lệ!");
    }
  };
  reader.readAsText(file);
};

// Khởi động
document.getElementById("viewPlatformsBtn").onclick = renderPlatforms;
renderPlatforms();

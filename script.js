const accountContainer = document.getElementById("accountContainer");
const modal = document.getElementById("modal");
const addBtn = document.getElementById("addBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

let data = {};

fetch("data.json")
  .then(res => res.json())
  .then(json => {
    data = json;
    render();
  });

function render() {
  accountContainer.innerHTML = "";
  Object.keys(data).forEach(platform => {
    data[platform].forEach((acc, i) => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <button class="delete-btn" onclick="remove('${platform}', ${i})"><i class="fas fa-trash"></i></button>
        <h3>${getIcon(platform)} ${acc.name}</h3>
        <p><b>Email:</b> ${acc.mail}</p>
        <p><b>Pass:</b> ${acc.mk}</p>
        <p><b>2FA:</b> ${acc["2fa"]}</p>
      `;
      accountContainer.appendChild(div);
    });
  });
}

function getIcon(platform) {
  switch (platform) {
    case "Tiktok": return `<i class="fab fa-tiktok" style="color:#ff0050"></i>`;
    case "Face": return `<i class="fab fa-facebook" style="color:#3b82f6"></i>`;
    case "IG": return `<i class="fab fa-instagram" style="color:#ec4899"></i>`;
    default: return "🌐";
  }
}

addBtn.onclick = () => modal.classList.remove("hidden");
cancelBtn.onclick = () => modal.classList.add("hidden");

saveBtn.onclick = () => {
  const platform = document.getElementById("platform").value;
  const name = document.getElementById("name").value.trim();
  const mail = document.getElementById("mail").value.trim();
  const mk = document.getElementById("mk").value.trim();
  const fa = document.getElementById("fa").value.trim();

  if (!platform || !name || !mail || !mk) return alert("Điền đầy đủ thông tin!");

  data[platform].push({ name, mail, mk, "2fa": fa });
  modal.classList.add("hidden");
  render();
  saveToLocal();
};

function remove(platform, index) {
  if (confirm("Xóa tài khoản này?")) {
    data[platform].splice(index, 1);
    render();
    saveToLocal();
  }
}

function saveToLocal() {
  localStorage.setItem("accounts", JSON.stringify(data));
}

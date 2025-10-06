const accounts = { Tiktok: [], Face: [], IG: [] };

function addAccount(type) {
  const name = prompt(`Tên tài khoản ${type}:`);
  const mail = prompt(`Email:`);
  const mk = prompt(`Mật khẩu:`);
  const fa = prompt(`2FA:`);
  if (!name || !mail || !mk) return alert("Thiếu thông tin!");

  accounts[type].push({ name, mail, mk, "2fa": fa });
  renderAccounts();
}

function renderAccounts() {
  const div = document.getElementById("accounts");
  div.innerHTML = "";
  for (let type in accounts) {
    if (accounts[type].length > 0) {
      const title = document.createElement("h3");
      title.innerText = type;
      div.appendChild(title);
      accounts[type].forEach(acc => {
        const a = document.createElement("div");
        a.className = "account";
        a.innerHTML = `
          <b>${acc.name}</b><br>
          ${acc.mail}<br>
          ${acc.mk}<br>
          2FA: ${acc["2fa"]}
        `;
        div.appendChild(a);
      });
    }
  }
}

async function saveToGitHub() {
  const token = document.getElementById("token").value.trim();
  const repo = document.getElementById("repo").value.trim();
  if (!token || !repo) return alert("Nhập token & repo!");

  const path = "accounts.json";
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;

  // 1️⃣ Kiểm tra file đã tồn tại chưa
  let sha = null;
  const res = await fetch(api, { headers: { Authorization: `token ${token}` } });
  if (res.status === 200) {
    const data = await res.json();
    sha = data.sha;
  }

  // 2️⃣ Gửi PUT để ghi file mới
  const body = {
    message: "update accounts.json",
    content: btoa(JSON.stringify(accounts, null, 2)),
    sha: sha || undefined
  };

  const save = await fetch(api, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${token}`
    },
    body: JSON.stringify(body)
  });

  if (save.ok) alert("✅ Lưu thành công lên GitHub!");
  else alert("❌ Lỗi khi lưu: " + save.status);
}

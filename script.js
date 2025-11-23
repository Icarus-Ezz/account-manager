// =========================================================================
// 1. Cấu hình & Khởi tạo Biến
// =========================================================================
const GITHUB_REPO = "Icarus-Ezz/account-manager"; // <--- username/repo
let _OBF_B64 = "gsE2KTxwSDMBPNGCuGjxRKH/AR06MQYoEl3S+MtQ2hLdkXYxcClyEw==";
let _OBF_KEY_HEX = "e5a94676484631724869e0b18f0a937c";
const DATA_FILENAME = "data.json";
const AUTO_PUSH = true; // auto push khi có thay đổi (true/false)
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/refs/heads/main/${DATA_FILENAME}`;
const WEB_PASS = "PC"; // mật khẩu đăng nhập

let data = {};
let platforms = {};
let currentPlatform = null;
let editAccountContext = null;
let editPlatformContext = null;
let pendingRemove = null; // { platform, index }

// Cache DOM Elements
const platformListEl = document.getElementById("platformList");
const accountGrid = document.getElementById("accountGrid");
const currentPlatformTitle = document.getElementById("currentPlatformTitle");
const platformSummary = document.getElementById("platformSummary");
const accountModal = document.getElementById("accountModal");
const platformModal = document.getElementById("platformModal");
const nurtureIcon = document.getElementById("nurtureIcon");
const nurtureCount = document.getElementById("nurtureCount");
const nurtureModal = document.getElementById("nurtureModal");
const nurtureAccountGrid = document.getElementById("nurtureAccountGrid"); // Grid bên trong modal
const exitNurtureDropzone = document.getElementById('exitNurtureDropzone'); // Nút X mới
const unNurtureIcon = document.getElementById('unNurtureIcon'); // Nút Đẩy ra ngoài mới
const closeModalBtn = document.getElementById('closeNurtureModal');
// Inputs
const accNameInput = document.getElementById("acc_name");
const accMailInput = document.getElementById("acc_mail");
const accPassInput = document.getElementById("acc_pass");
const acc2faInput = document.getElementById("acc_2fa");
const platNameInput = document.getElementById("plat_name");
const platIconInput = document.getElementById("plat_icon");
const platColorInput = document.getElementById("plat_color");
const nurtureCountElement = document.getElementById('nurtureCount'); // Đã thêm để sử dụng trong updateNurtureCount

// =========================================================================
// 2. Hàm Tiện ích (Utils)
// =========================================================================

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
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
        const keyBytes = hexToBytes(keyHex);
        const obf = base64ToBytes(b64);
        const out = new Uint8Array(obf.length);
        for (let i = 0; i < obf.length; i++) {
            out[i] = obf[i] ^ keyBytes[i % keyBytes.length];
        }
        return new TextDecoder("utf-8").decode(out);
    } catch (e) {
        console.error("Token decode error:", e);
        return "";
    }
}
const GITHUB_TOKEN = decodeObfToken(_OBF_B64, _OBF_KEY_HEX);
_OBF_B64 = null; _OBF_KEY_HEX = null;

function randomColor() {
    const hues = [200, 220, 260, 340, 20, 40, 120];
    const h = hues[Math.floor(Math.random() * hues.length)];
    return `hsl(${h} 80% 55%)`;
}
function escapeHtml(s) {
    if (s === undefined || s === null) return "";
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function initials(name) {
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700">${escapeHtml(name.slice(0, 2).toUpperCase())}</div>`;
}
function addPlatformDef(name, icon, color) {
    platforms[name] = { icon: icon || "", color: color || randomColor() };
    if (!data[name]) data[name] = [];
}
// Helper: làm đậm/nhạt màu gradient
function shadeColor(color, percent) {
    // Chỉ hoạt động với HEX
    if (color.startsWith('hsl')) return color; 
    let R = parseInt(color.substring(1, 3), 16),
        G = parseInt(color.substring(3, 5), 16),
        B = parseInt(color.substring(5, 7), 16);
    R = Math.min(255, parseInt(R * (100 + percent) / 100));
    G = Math.min(255, parseInt(G * (100 + percent) / 100));
    B = Math.min(255, parseInt(B * (100 + percent) / 100));
    const RR = R.toString(16).padStart(2, "0");
    const GG = G.toString(16).padStart(2, "0");
    const BB = B.toString(16).padStart(2, "0");
    return `#${RR}${GG}${BB}`;
}

function loadState() {
    try {
        const s = localStorage.getItem("am_data_v2");
        const p = localStorage.getItem("am_platforms_v2");
        if (s) data = JSON.parse(s);
        if (p) platforms = JSON.parse(p);
    } catch {
        data = {}; platforms = {};
    }
    // Thiết lập platforms mặc định nếu chưa có
    if (!Object.keys(platforms).length) {
        addPlatformDef("TikTok", "", "#ff0050");
        addPlatformDef("Facebook", "", "#1877f2");
        addPlatformDef("Instagram", "", "#ec4899");
    }
    // Đảm bảo mỗi platform có 1 mảng accounts
    Object.keys(platforms).forEach(k => { if (!data[k]) data[k] = []; });
}

function saveState() {
    localStorage.setItem("am_data_v2", JSON.stringify(data, null, 2));
    localStorage.setItem("am_platforms_v2", JSON.stringify(platforms, null, 2));
}

// Hàm bổ sung: Render tất cả tài khoản đang được nuôi dưỡng vào Modal
function renderNurturedAccounts() {
    if (!nurtureAccountGrid) return;

    nurtureAccountGrid.innerHTML = "";
    let totalNurtured = 0;

    for (const platform in data) {
        if (data.hasOwnProperty(platform)) {
            const list = data[platform];
            const platMeta = platforms[platform] || { color: "#3b82f6", icon: "" };

            list.forEach((acc, idx) => {
                if (acc.isNurtured) {
                    const card = createAccountCard(acc, idx, platMeta, platform); // Truyền thêm platform
                    nurtureAccountGrid.appendChild(card);
                    totalNurtured++;
                }
            });
        }
    }
    updateNurtureIcon(totalNurtured);
    updateNurturePlaceholder();
}


function renderAccounts() {
    accountGrid.innerHTML = "";
    // Xóa nội dung Nurture Area Modal trước khi render (chỉ trong renderAccounts nếu cần)
    // if (nurtureAccountGrid) nurtureAccountGrid.innerHTML = ""; // Đã chuyển sang renderNurturedAccounts

    if (!currentPlatform) {
        currentPlatformTitle.innerText = "Chọn nền tảng";
        platformSummary.innerText = "Chọn nền tảng ở sidebar để xem tài khoản.";
        updateNurtureCount(); // Dùng hàm tổng thể
        return;
    }

    const list = data[currentPlatform] || [];
    const platMeta = platforms[currentPlatform] || { color: "#3b82f6", icon: "" };

    currentPlatformTitle.innerText = currentPlatform;
    platformSummary.innerText = `${list.length} tài khoản`;
    
    
    list.forEach((acc, idx) => {
        // Gán ID duy nhất nếu chưa có (QUAN TRỌNG)
        if (!acc.id) acc.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        // Chỉ thêm vào lưới chính nếu KHÔNG đang được nuôi dưỡng
        if (!acc.isNurtured) {
            const card = createAccountCard(acc, idx, platMeta, currentPlatform);
            accountGrid.appendChild(card); 
        }
    });
    
    // Cập nhật icon Vùng Nuôi (Dùng hàm tổng thể)
    updateNurtureCount();
    // updateNurturePlaceholder(); // Chỉ cần chạy khi modal mở
}

// Tạo thẻ tài khoản
// Đã sửa: Thêm tham số 'platformName' để dragend biết nguồn gốc của thẻ khi thẻ nằm trong Modal
function createAccountCard(acc, idx, platMeta, platformName) {
    const card = document.createElement("div");
    card.className = "card account-card draggable";
    card.setAttribute('draggable', 'true');
    card.dataset.accountId = acc.id;
    card.dataset.idx = idx;
    card.dataset.platform = platformName; // Gán nền tảng gốc của thẻ

    // Màu nền gradient
    card.style.background = `linear-gradient(135deg, ${platMeta.color}, ${shadeColor(platMeta.color, -20)})`;

    card.innerHTML = `
        <div class="head">
            <div class="info">
                <div class="icon-small" style="background:${platMeta.color}">
                    ${platMeta.icon ? `<img src="${escapeHtml(platMeta.icon)}"/>` : platformName[0].toUpperCase()}
                </div>
                <div>
                    <h4>${escapeHtml(acc.name)}</h4>
                    <p class="muted">${escapeHtml(acc.mail)}</p>
                </div>
            </div>
            <div class="actions">
                ${!acc.isNurtured ? `
                <button class="btn-icon primary" data-action="nurture" data-idx="${idx}" title="Thêm vào Vùng Nuôi">
                    <i class="fas fa-seedling"></i>
                </button>
                ` : ''} 
                <button class="btn-icon" data-action="edit" data-idx="${idx}" title="Sửa tài khoản">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="btn-icon danger" data-action="del" data-idx="${idx}" title="Xóa tài khoản">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="details">
            <p><b>Pass:</b>
                <span class="blur copyField" data-copy="${escapeHtml(acc.mk)}">${escapeHtml(acc.mk)}</span>
            </p>
            <p><b>2FA:</b>
                <span class="blur copyField" data-copy="${escapeHtml(acc["2fa"] || "")}">${acc["2fa"] ? '••••••••••••••••••••••••••••••' : 'Chưa có'}</span>
            </p>
        </div>
    `;

    // Thêm sự kiện cho nút Sửa/Xóa
    card.querySelector('[data-action="edit"]').addEventListener("click", (e) => {
        e.stopPropagation(); openEditAccount(idx);
    });
    card.querySelector('[data-action="del"]').addEventListener("click", (e) => {
        e.stopPropagation(); removeAccount(platformName, idx); // Sửa: Dùng platformName
    });

    // START: THÊM SỰ KIỆN CHO NÚT VÙNG NUÔI MỚI (Click)
    const nurtureBtn = card.querySelector('[data-action="nurture"]');
    if (nurtureBtn) {
        nurtureBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Lấy ID tài khoản từ card
            const accountId = e.currentTarget.closest('.account-card').dataset.accountId;
            // Cập nhật trạng thái
            if (updateAccountNurtureStatus(platformName, accountId, true)) {
                renderAccounts(); // Re-render lưới chính
                updateNurtureCount();
            }
        });
    }
    // END: THÊM SỰ KIỆN CHO NÚT VÙNG NUÔI MỚI

    // THÊM SỰ KIỆN KÉO THẢ (Chỉ cần thêm 1 lần khi tạo thẻ)
    addDragEvents(card);
    
    return card;
}

// Cập nhật Icon Nurture Area (hiện số lượng)
function updateNurtureIcon(count) {
    if (nurtureIcon) {
        if (count > 0) {
            nurtureIcon.classList.remove('hidden');
            nurtureCount.innerText = count;
        } else {
            // nurtureIcon.classList.add('hidden'); // Có thể ẩn nếu không có
            nurtureCount.innerText = 0;
        }
    }
}
// Cập nhật trạng thái placeholder của Vùng Nuôi trong Modal
function updateNurturePlaceholder() {
    if (!nurtureAccountGrid) return;
    const placeholder = nurtureAccountGrid.querySelector('.placeholder');
    const cards = nurtureAccountGrid.querySelectorAll('.account-card');

    if (cards.length === 0) {
        if (!placeholder) {
            nurtureAccountGrid.innerHTML = '<p class="muted placeholder">Kéo tài khoản vào đây để nhóm</p>';
        } else {
            placeholder.style.display = 'block';
        }
    } else if (placeholder) {
        placeholder.style.display = 'none';
    }
}
function updateNurtureCount() {
    let totalNurtured = 0;
    
    // 1. Tính tổng số tài khoản nuôi
    for (const platform in data) {
        if (data.hasOwnProperty(platform)) {
            totalNurtured += data[platform].filter(acc => acc.isNurtured).length;
        }
    }
    
    // 2. Cập nhật số đếm
    if (nurtureCountElement) { 
        nurtureCountElement.textContent = totalNurtured;
    }

    // 3. Kiểm soát hiển thị các ICON CỐ ĐỊNH
    if (nurtureIcon) { 
        if (totalNurtured > 0) {
            // Khi có tài khoản, hiển thị (bỏ hidden)
            nurtureIcon.classList.remove('hidden'); 
        } else {
            // Khi không có tài khoản, ẩn (thêm hidden)
            nurtureIcon.classList.add('hidden'); 
        }
    }
    
    if (unNurtureIcon) {
        if (totalNurtured > 0) {
            unNurtureIcon.classList.remove('hidden'); 
        } else {
            unNurtureIcon.classList.add('hidden'); 
        }
    }
}
function renderPlatforms() {
    platformListEl.innerHTML = "";
    Object.keys(platforms).forEach((plat) => {
        const meta = platforms[plat];
        const count = data[plat]?.length || 0;
        const item = document.createElement("div");
        item.className = `platform-item ${currentPlatform === plat ? 'active' : ''}`;
        item.dataset.name = plat;
        
        item.innerHTML = `
            <div class="platform-thumb" style="background:${meta.color}">
                ${meta.icon ? `<img src="${escapeHtml(meta.icon)}"/>` : initials(plat)}
            </div>
            <div class="platform-meta">
                <div class="title">${escapeHtml(plat)}</div>
                <div class="count">${count} tài khoản</div>
            </div>
            <div class="actions">
                <button class="btn-icon" data-action="edit-plat" data-plat="${escapeHtml(plat)}" title="Sửa">
                    <i class="fas fa-pen" data-action="edit-plat" data-plat="${escapeHtml(plat)}"></i>
                </button>
                <button class="btn-icon danger" data-action="del-plat" data-plat="${escapeHtml(plat)}" title="Xóa">
                    <i class="fas fa-trash" data-action="del-plat" data-plat="${escapeHtml(plat)}"></i>
                </button>
            </div>
        `;

        item.addEventListener("click", (e) => {
            if (e.target.closest('[data-action]')) return;
            selectPlatform(plat);
        });

        platformListEl.appendChild(item);
    });
    
    // Đánh dấu platform đang chọn
    selectPlatform(currentPlatform, false); 
}

function selectPlatform(name, doRender = true) {
    if (currentPlatform) {
        document.querySelector(`.platform-item[data-name="${currentPlatform}"]`)?.classList.remove('active');
    }
    currentPlatform = name;
    if (currentPlatform) {
        document.querySelector(`.platform-item[data-name="${currentPlatform}"]`)?.classList.add('active');
    }
    if (doRender) renderAccounts();
}

// =========================================================================
// 5. CRUD Logic (Sửa/Xóa/Lưu)
// =========================================================================

// Xử lý Xóa Tài khoản
function removeAccount(platform, index) {
    const acc = data[platform]?.[index];
    if (!acc) return;

    pendingRemove = { platform, index };
    document.getElementById("removeModalMsg").innerText = `Bạn có muốn xóa acc "${acc.name}" ?`;
    document.getElementById("removeInput").value = "";
    document.getElementById("removeModal").classList.remove("hidden");
}

document.getElementById("confirmRemove").onclick = () => {
    const v = document.getElementById("removeInput").value.trim().toUpperCase();
    if (v !== "D" && v !== "R") {
        alert("Bạn chỉ có thể nhập D hoặc R"); return;
    }
    if (!pendingRemove) return;

    const { platform, index } = pendingRemove;
    data[platform]?.splice(index, 1);

    saveState();
    if (currentPlatform === platform) renderAccounts();
    if (AUTO_PUSH) tryPush();

    document.getElementById("removeModal").classList.add("hidden");
    pendingRemove = null;
};
document.getElementById("cancelRemove").onclick = () => {
    document.getElementById("removeModal").classList.add("hidden");
    pendingRemove = null;
};

// Account Modal
document.getElementById("addAccountBtn").addEventListener("click", () => {
    if (!currentPlatform) return alert("Vui lòng chọn nền tảng trước.");
    openAddAccount();
});
function openAddAccount() {
    editAccountContext = null;
    document.getElementById("accountModalTitle").innerText = `Thêm tài khoản — ${currentPlatform}`;
    accNameInput.value = accMailInput.value = accPassInput.value = acc2faInput.value = "";
    document.getElementById("otp_code").value = "";
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
    document.getElementById("otp_code").value = "";
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

    const newAccountData = { name, mail, mk, "2fa": fa };

    if (editAccountContext) {
        const acc = data[editAccountContext.platform][editAccountContext.index];
        newAccountData.id = acc.id; 
        newAccountData.isNurtured = acc.isNurtured || false; 
        data[editAccountContext.platform][editAccountContext.index] = newAccountData;
    } else {
        newAccountData.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        newAccountData.isNurtured = false; 
        data[currentPlatform].push(newAccountData);
    }

    saveState();
    renderAccounts();
    accountModal.classList.add("hidden");
    if (AUTO_PUSH) await tryPush();
};

// Platform Modal Events
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
        // Chuyển dữ liệu tài khoản nếu tên thay đổi
        if (oldName !== name) {
            data[name] = data[oldName] || [];
            delete data[oldName];
        }
        platforms[name] = { icon, color };
        if (oldName !== name) delete platforms[oldName];
        if (currentPlatform === oldName) currentPlatform = name;
    } else {
        if (!platforms[name]) platforms[name] = { icon, color };
        if (!data[name]) data[name] = [];
    }
    
    saveState(); renderPlatforms(); renderAccounts();
    platformModal.classList.add("hidden");
    if (AUTO_PUSH) await tryPush();
};

// Platform List Actions (Edit/Delete)
platformListEl.addEventListener("click", e => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const plat = target.dataset.plat;

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


// =========================================================================
// 6. Logic Kéo/Thả Vùng Nuôi (Drag & Drop)
// =========================================================================

function addDragEvents(accountCard) {
    accountCard.addEventListener('dragstart', (e) => {
        e.currentTarget.classList.add('dragging');
        // Lưu ID và Platform GỐC vào dataTransfer
        e.dataTransfer.setData('text/plain', e.currentTarget.dataset.accountId);
        // Lấy platform từ dataset của thẻ (đã được gán trong createAccountCard)
        e.dataTransfer.setData('application/json', e.currentTarget.dataset.platform);
        
        // Ngăn kéo thả từ modal
        if (e.target.closest('#nurtureModal')) e.dataTransfer.effectAllowed = "move";
    });

    accountCard.addEventListener('dragend', (e) => {
        e.currentTarget.classList.remove('dragging');
    });
}

// Hàm tìm tài khoản trong mảng và cập nhật trạng thái isNurtured (GIỮ NGUYÊN)
function updateAccountNurtureStatus(platform, accountId, isNurtured) {
    const list = data[platform];
    if (!list) return false;

    const accIndex = list.findIndex(acc => acc.id === accountId);
    if (accIndex === -1) return false;

    list[accIndex].isNurtured = isNurtured;
    saveState();
    if (AUTO_PUSH) tryPush();
    return true;
}

// =========================================================================
// 2. HÀM XỬ LÝ DROP (handleDrop) - ĐÃ SỬA THÊM UN-NURTURE ICON
// =========================================================================
function handleDrop(e) {
    e.preventDefault();
    
    // 1. Dọn dẹp hiệu ứng kéo thả
    e.currentTarget.classList.remove('drag-over', 'drag-over-main', 'drag-over-nurture', 'btn-danger-hover'); 

    // 2. Lấy dữ liệu
    const accountId = e.dataTransfer.getData('text/plain');
    const sourcePlatform = e.dataTransfer.getData('application/json'); 
    
    // 3. LOGIC XÁC ĐỊNH HÀNH ĐỘNG
    const targetId = e.currentTarget.id;
    let isNurtured;

    if (targetId === 'nurtureIcon' || targetId === 'nurtureAccountGrid') {
        // HÀNH ĐỘNG: Kéo VÀO Vùng Nuôi
        isNurtured = true;
    } 
    // KIỂM TRA NÚT MỚI #unNurtureIcon
    else if (targetId === 'accountGrid' || targetId === 'exitNurtureDropzone' || targetId === 'unNurtureIcon') { 
        // HÀNH ĐỘNG: Kéo RA NGOÀI (Thả vào lưới chính, Nút X HOẶC Nút UN-NURTURE MỚI)
        isNurtured = false;
        
        // Fix lỗi đóng modal khi kéo ra khỏi Modal Nurture
        if (targetId === 'exitNurtureDropzone' && nurtureModal) {
            nurtureModal.classList.add('hidden');
        }
        
    } else {
        return; 
    }

    // 4. Cập nhật trạng thái trong dữ liệu
    if (updateAccountNurtureStatus(sourcePlatform, accountId, isNurtured)) { // SỬ DỤNG sourcePlatform (đã fix lỗi trước)
        
        // 5. Cập nhật giao diện:
        renderAccounts(); 
        
        // Nếu modal đang mở, cập nhật lại nội dung modal
        if (nurtureModal && !nurtureModal.classList.contains('hidden')) {
             renderNurturedAccounts();
        }
        
        updateNurtureCount(); 
    }
}
// =========================================================================
// 3. HÀM QUẢN LÝ MODAL VÀ SỰ KIỆN DROP CỦA ICON - ĐÃ SỬA
// =========================================================================

function openNurtureModal() {
    nurtureModal.classList.remove('hidden');
    renderNurturedAccounts(); 
} 

window.addEventListener("DOMContentLoaded", () => {
    // --- KHỞI TẠO ---
    loadState(); // Đảm bảo đã load state trước khi render/update
    renderPlatforms();
    updateNurtureCount(); 

    // --- SỰ KIỆN DROP CHO ACCOUNT GRID (Thoát khỏi Vùng Nuôi) ---
    if (accountGrid) {
        accountGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over-main');
        });
        accountGrid.addEventListener('dragleave', () => {
            accountGrid.classList.remove('drag-over-main');
        });
        accountGrid.addEventListener('drop', handleDrop);
    }

    // --- SỰ KIỆN DROP VÀ CLICK CHO NURTURE ICON (Vào Vùng Nuôi) ---
    if (nurtureIcon) {
        nurtureIcon.addEventListener('click', openNurtureModal);
        
        nurtureIcon.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        });
        nurtureIcon.addEventListener('dragleave', () => {
            e.currentTarget.classList.remove('drag-over');
        });
        nurtureIcon.addEventListener('drop', handleDrop);
    }
    
    // --- SỰ KIỆN CHO NÚT THOÁT VÙNG NUÔI (#exitNurtureDropzone) ---
    if (exitNurtureDropzone) {
        // Sự kiện CLICK để đóng Modal (chức năng cơ bản của nút X)
        exitNurtureDropzone.addEventListener('click', () => {
            nurtureModal.classList.add("hidden");
            // Re-render lưới chính để hiển thị thẻ nếu nó vừa bị kéo ra khỏi Vùng Nuôi (trong modal)
            renderAccounts(); 
        });

        // Sự kiện DROPZONE để Kéo Ra Ngoài
        exitNurtureDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.currentTarget.classList.add('btn-danger-hover'); // Hiệu ứng hover
        });
        exitNurtureDropzone.addEventListener('dragleave', () => {
            e.currentTarget.classList.remove('btn-danger-hover');
        });
        exitNurtureDropzone.addEventListener('drop', handleDrop); // Dùng lại handleDrop
    }

    // --- SỰ KIỆN DROP CHO NURTURE GRID TRONG MODAL ---
    if (nurtureAccountGrid) {
        nurtureAccountGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over-nurture');
        });
        nurtureAccountGrid.addEventListener('dragleave', () => {
            e.currentTarget.classList.remove('drag-over-nurture');
        });
        nurtureAccountGrid.addEventListener('drop', handleDrop);
    }
    
    // --- SỰ KIỆN DROP CHO UN-NURTURE ICON (NÚT MỚI) ---
    if (unNurtureIcon) { 
        unNurtureIcon.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        });
        unNurtureIcon.addEventListener('dragleave', () => {
            unNurtureIcon.classList.remove('drag-over');
        });
        unNurtureIcon.addEventListener('drop', handleDrop);
    }
    
    // Nút mở 2FA (GIỮ NGUYÊN)
    const go2FABtn = document.getElementById("go2FA");
    if (go2FABtn) go2FABtn.addEventListener("click", () => window.open("https://2fa.live/", "_blank"));
});
// KHAI BÁO BIẾN CẦN THIẾT (Đã chuyển lên đầu file)
// const nurtureCountElement = document.getElementById('nurtureCount');

function updateNurtureCount() {
    let totalNurtured = 0;
    
    // 1. Tính tổng số tài khoản nuôi
    for (const platform in data) {
        if (data.hasOwnProperty(platform)) {
            totalNurtured += data[platform].filter(acc => acc.isNurtured).length;
        }
    }

    // 2. Kiểm soát hiển thị
    if (nurtureIcon && nurtureCountElement) { 
        nurtureCountElement.textContent = totalNurtured;
        
        if (totalNurtured > 0) {
            // Khi có tài khoản, BỎ class 'hidden' trên CẢ HAI nút
            nurtureIcon.classList.remove('hidden'); 
            if (unNurtureIcon) unNurtureIcon.classList.remove('hidden'); 
        } else {
            // Khi không có tài khoản, THÊM class 'hidden' trên CẢ HAI nút
            nurtureIcon.classList.add('hidden'); 
            if (unNurtureIcon) unNurtureIcon.classList.add('hidden'); 
        }
    }
}
// =========================================================================
// 7. GitHub Sync
// =========================================================================

async function tryPush() {
    if (!GITHUB_REPO) { console.warn("⚠️ GitHub: chưa cấu hình repo"); return; }
    if (!GITHUB_TOKEN) {
        alert("⚠️ Repo public nhưng không có token nên không thể push. Chỉ lưu local.");
        saveState(); return;
    }

    const api = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILENAME}`;
    try {
        let sha = null;
        const check = await fetch(api, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        if (check.status === 200) sha = (await check.json()).sha;

        const content = btoa(unescape(encodeURIComponent(JSON.stringify({ data, platforms }, null, 2))));

        const res = await fetch(api, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `token ${GITHUB_TOKEN}` },
            body: JSON.stringify({ message: "Update data.json", content, sha, branch: "main" })
        });

        if (!res.ok) throw new Error(await res.text());

        console.log("✅ Push GitHub thành công");
        // alert("✅ Đã lưu và cập nhật lên GitHub!");
    } catch (e) {
        console.error("❌ Push GitHub lỗi:", e);
        // alert("❌ Không thể push GitHub: " + e.message);
    }
}

async function loadFromRawGitHub() {
    try {
        const res = await fetch(GITHUB_RAW_URL + "?_=" + Date.now());
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        if (json.data && json.platforms) {
            data = json.data; platforms = json.platforms;
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


// =========================================================================
// 8. Toggles & Login
// =========================================================================

const themeToggle = document.getElementById("themeToggle");
(function initTheme() {
    const t = localStorage.getItem("am_theme") || "light";
    if (t === "dark") { document.documentElement.setAttribute("data-theme", "dark"); themeToggle.checked = true; }
})();
themeToggle.addEventListener("change", () => {
    const theme = themeToggle.checked ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("am_theme", theme);
});

document.addEventListener("DOMContentLoaded", checkLogin);

function checkLogin() {
    const saved = localStorage.getItem("app_login_pass_saved");
    if (saved === "1") {
        hideLogin();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById("loginModal").classList.remove("hidden");
    document.getElementById("loginInput").focus();
}

function hideLogin() {
    document.getElementById("loginModal").classList.add("hidden");
    init(); 
}

document.getElementById("loginBtn").onclick = () => {
    const inp = document.getElementById("loginInput").value.trim();
    if (inp === WEB_PASS) {
        localStorage.setItem("app_login_pass_saved", "1");
        hideLogin(); 
    } else {
        alert("Sai mật khẩu");
    }
};

// =========================================================================
// 9. UI & Copy/Toast
// =========================================================================

// Toast
let toast = document.createElement("div");
toast.className = "copyToast";
document.body.appendChild(toast);

document.addEventListener("click", async(e)=>{
    // Toggle blur
    if(e.target.classList.contains("blur")){
        e.target.classList.toggle("show");
    }
    // Copy
    if (e.target.classList.contains("copyField")) {
        let val = e.target.dataset.copy || "";
        if (!val) return;
        await navigator.clipboard.writeText(val);
        toast.innerText = "✓ Copied";
        toast.classList.add("show");
        setTimeout(()=>toast.classList.remove("show"),1200);
    }
});


// =========================================================================
// 10. Random Generators & External API
// =========================================================================

// Tên ngẫu nhiên
(() => {
    const genBtn = document.getElementById("genNameBtn");
    if (!genBtn) return;
    // ... (Giữ nguyên logic list_ten và genRandomName) ...
    const list_ten = {
        first: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Mai', 'Tạ', 'Đoàn', 'Cao', 'Trương', 'Đinh', 'Lý', 'Châu', 'Vương', 'Đào'],
        mid: ['Văn', 'Thị', 'Minh', 'Thanh', 'Quốc', 'Tuấn', 'Đức', 'Hồng', 'Hải', 'Xuân', 'Kim', 'Bảo', 'Gia', 'Nhật', 'Thái', 'Ngọc', 'Anh', 'Hoàng', 'Khánh', 'Phương', 'Thiên', 'Trung', 'Hữu', 'Diệu', 'Tường', 'Anh', 'Thảo', 'Như', 'Cẩm', 'Hà'],
        last_male: ['Anh', 'An', 'Bảo', 'Bình', 'Dũng', 'Huy', 'Khánh', 'Long', 'Phúc', 'Quang', 'Sơn', 'Tùng', 'Vinh', 'Đạt', 'Trung', 'Khang', 'Nam', 'Phong', 'Hiếu', 'Thắng', 'Tuấn'],
        last_female: ['Linh', 'Ngọc', 'Trang', 'Hương', 'Thảo', 'Yến', 'Như', 'Vy', 'Mai', 'Châu', 'Lan', 'Nhi', 'Phương', 'Hà', 'My', 'Hằng', 'Diễm', 'Giang', 'Tuyết', 'Thư', 'Ngân']
    };
    const rand = arr => arr[Math.floor(Math.random() * arr.length)];
    let usedNames = new Set();
    function genRandomName() {
        const isMale = Math.random() < 0.5;
        const lastList = isMale ? list_ten.last_male : list_ten.last_female;
        let fullName, tries = 0;
        do {
            const first = rand(list_ten.first);
            const midCount = Math.random() < 0.5 ? 1 : 2;
            const mids = [];
            for (let i = 0; i < midCount; i++) mids.push(rand(list_ten.mid));
            const last = rand(lastList);
            const nameParts = [first, ...mids, last];
            fullName = nameParts.join(" ");
            tries++;
        } while (usedNames.has(fullName) && tries < 50);
        usedNames.add(fullName);
        return fullName;
    }
    genBtn.addEventListener("click", () => {
        const input = document.getElementById("acc_name");
        if (!input) return;
        const ten = genRandomName();
        input.value = ten;
        input.style.transition = "background 0.3s";
        input.style.background = "#d1fae5";
        setTimeout(() => (input.style.background = ""), 400);
    });
})();

// Mật khẩu ngẫu nhiên
(() => {
    const genMkBtn = document.getElementById("genMkBtn");
    if (!genMkBtn) return;
    // ... (Giữ nguyên logic genRandomPassword) ...
    const LOWER = "abcdefghijklmnopqrstuvwxyz";
    const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const DIGITS = "0123456789";
    const SPECIAL = "!@#$%^&*()_+[]{}|;:,.<>?/`~-=";
    const ALL = LOWER + UPPER + DIGITS + SPECIAL;
    const shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };
    function genRandomPassword(length = 14) {
        const passwordChars = [
            LOWER[Math.floor(Math.random() * LOWER.length)],
            UPPER[Math.floor(Math.random() * UPPER.length)],
            DIGITS[Math.floor(Math.random() * DIGITS.length)],
            SPECIAL[Math.floor(Math.random() * SPECIAL.length)]
        ];
        for (let i = passwordChars.length; i < length; i++) {
            passwordChars.push(ALL[Math.floor(Math.random() * ALL.length)]);
        }
        return shuffle(passwordChars).join("");
    }
    genMkBtn.addEventListener("click", () => {
        const input = document.getElementById("acc_pass");
        if (!input) return;
        const password = genRandomPassword(14);
        input.value = password;
        input.style.transition = "background 0.3s, box-shadow 0.3s";
        input.style.background = "#fef3c7";
        input.style.boxShadow = "0 0 6px rgba(0,0,0,0.08)";
        setTimeout(() => {
            input.style.background = "";
            input.style.boxShadow = "";
        }, 400);
    });
})();

// Email & OTP
const DOMAINS = [
    "tempmail.id.vn", "1trick.net", "hathitrannhien.edu.vn", 
    "nghienplus.io.vn", "tempmail.ckvn.edu.vn"
];
function randomString(length = 10) {
    let chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}
document.getElementById("btn_random").onclick = () => {
    let mail = randomString(10) + "@" + DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
    document.getElementById("acc_mail").value = mail;
};

document.getElementById("btn_check").onclick = async () => {
    const token = "mHxzxzG1oUkyfOWWU8OHuaU8ws7qn4msrBdBHc2I70c2fffa";
    const email = document.getElementById("acc_mail").value;

    if (!email) return alert("Chưa nhập email!");

    try {
        const [user, domain] = email.split("@");
        // 1. Lấy danh sách mail
        let listRes = await fetch("https://tempmail.id.vn/api/email", { headers: { "Authorization": `Bearer ${token}` } });
        let listJson = await listRes.json();
        let mailObj = (listJson?.data || []).find(m => m.email === email);

        // 2. Nếu email chưa tồn tại → tạo mới
        if (!mailObj) {
            let createRes = await fetch("https://tempmail.id.vn/api/email/create", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ user, domain })
            });
            mailObj = (await createRes.json())?.data;
            if (!mailObj) return alert("Không thể tạo email!");
        }

        // 3. Lấy danh sách thư
        let inboxRes = await fetch(`https://tempmail.id.vn/api/email/${mailObj.id}`, { headers: { "Authorization": `Bearer ${token}` } });
        let messages = (await inboxRes.json())?.data?.items || [];
        if (!messages.length) return alert("Chưa có thư!");

        // 4. Đọc nội dung thư và tìm OTP
        let latest = messages[0];
        let msgRes = await fetch(`https://tempmail.id.vn/api/message/${latest.id}`, { headers: { "Authorization": `Bearer ${token}` } });
        let msgJson = await msgRes.json();
        let html = msgJson?.data?.html || msgJson?.data?.body || "";

        if (!html) return alert("Không đọc được nội dung thư!");
        
        // Regex tìm OTP 6 số
        let otp = (html.match(/\b\d{6}\b/) || ["Không tìm thấy OTP"])[0];
        document.getElementById("otp_code").value = otp;
        if(otp !== "Không tìm thấy OTP") {
            document.getElementById("otp_code").style.background = "#d1fae5";
            setTimeout(() => (document.getElementById("otp_code").style.background = ""), 400);
        }

    } catch (e) {
        console.error(e);
        alert("Lỗi API: " + e.message);
    }
};

// =========================================================================
// 11. Khởi chạy 🚀
// =========================================================================

function init() {
    loadState();
    renderPlatforms();
    const first = Object.keys(platforms)[0];
    if (first) selectPlatform(first);
    else renderAccounts();
}

// init() được gọi sau khi checkLogin thành công

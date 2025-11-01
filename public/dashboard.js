// CalcAI Dashboard JavaScript
// API base for server calls (esp. OTA endpoints)
const API_BASE = (window.CALCAI_API_BASE && String(window.CALCAI_API_BASE)) || "https://calcai-server.fly.dev";
// Orders data and helpers
let orders = [];

async function loadOrders() {
    try {
        const response = await fetch('/api/orders/list');
        if (!response.ok) throw new Error('Failed to load orders');
        const data = await response.json();
        orders = data.orders || [];
        renderOrders();
    } catch (e) {
        console.error(e);
        showOrdersAlert('Failed to load orders', 'error');
    }
    // initial load handled elsewhere (orders page).
}

function renderOrders() {
    const tbody = document.getElementById('ordersTable');
    if (!tbody) return; // page might not have orders section
    const q = (document.getElementById('ordersSearch')?.value || '').toLowerCase();
    const status = (document.getElementById('ordersStatus')?.value || '').toLowerCase();
    const filtered = orders.filter(o => {
        const matchesQ = !q || o.id.toLowerCase().includes(q) || (o.customer||'').toLowerCase().includes(q);
        const matchesStatus = !status || (o.status||'').toLowerCase() === status;
        return matchesQ && matchesStatus;
    });
    tbody.innerHTML = filtered.map(o => `
        <tr>
            <td style="padding:12px; border-bottom:1px solid var(--border-color); color:var(--text-primary);">${o.id}</td>
            <td style="padding:12px; border-bottom:1px solid var(--border-color); color:var(--text-muted);">${formatDate(o.date)}</td>
            <td style="padding:12px; border-bottom:1px solid var(--border-color);">${o.customer}</td>
            <td style="padding:12px; border-bottom:1px solid var(--border-color);">$${o.amount.toFixed(2)} ${o.currency}</td>
            <td style="padding:12px; border-bottom:1px solid var(--border-color);">
                ${renderStatusBadge(o.status)}
            </td>
            <td style="padding:12px; border-bottom:1px solid var(--border-color);">
                <button class="btn" onclick="viewOrder('${o.id}')">View</button>
            </td>
        </tr>
    `).join('');
}

function renderStatusBadge(status) {
    const map = {
        completed: 'status-online',
        processing: 'status-offline',
        failed: 'status-offline',
        refunded: 'status-offline'
    };
    const cls = map[status] || 'status-offline';
    return `<span class="device-status ${cls}" style="font-weight:600; text-transform:uppercase;">${status}</span>`;
}

async function viewOrder(id) {
    try {
        const resp = await fetch(`/api/orders/${id}`);
        if (!resp.ok) throw new Error('Not found');
        const o = await resp.json();
        const panel = document.getElementById('orderDetails');
        const content = document.getElementById('orderDetailsContent');
        content.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                <div><strong>ID:</strong> ${o.id}</div>
                <div><strong>Date:</strong> ${formatDate(o.date)}</div>
                <div><strong>Customer:</strong> ${o.customer}</div>
                <div><strong>Device:</strong> ${o.deviceId || '-'}</div>
                <div><strong>Status:</strong> ${renderStatusBadge(o.status)}</div>
                <div><strong>Amount:</strong> $${o.amount.toFixed(2)} ${o.currency}</div>
            </div>
            <hr class="hr" />
            <div>
                <strong>Items</strong>
                <div style="margin-top:8px;">
                    ${o.items.map(it => `<div style=\"display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding:6px 0;\"><span>${it.name} (x${it.qty})</span><span>$${(it.price*it.qty).toFixed(2)}</span></div>`).join('')}
                </div>
            </div>
            ${o.notes ? `<div style=\"margin-top:8px;\"><strong>Notes:</strong> ${o.notes}</div>` : ''}
        `;
        panel.classList.remove('hidden');
        panel.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
        showOrdersAlert('Failed to load order details', 'error');
    }
}

function showOrdersAlert(msg, type) {
    const el = document.getElementById('ordersAlert');
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(()=>{ el.style.display='none'; }, 4000);
}


let devices = {};
let firmwareVersions = [];
let activeVersion = null;
let selectedFirmwareFile = null;


// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();

    // Only init devices UI if devices container exists on this page
    if (document.getElementById('deviceList')) {
        loadDevices();
        // Auto-refresh every 30 seconds
        setInterval(() => {
            loadDevices();
        }, 30000);
    }

    // Only load firmware UI on the firmware page
    if (document.getElementById('firmwareList') || document.getElementById('uploadArea')) {
        loadFirmwareVersions();
    }
});

// Check if user is authenticated
async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
            const data = await response.json();
            const nameEl = document.getElementById('username');
            if (nameEl) nameEl.textContent = data.username || 'Admin';
        } else {
            // Do not client-redirect; server already protects /admin/*
            return false;
        }
    } catch (error) {
        console.warn('Auth check failed (non-blocking):', error);
        return false;
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            window.location.href = '/login';
        } else {
            alert('Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    let fileInput = document.getElementById('firmwareFile') || document.querySelector('input[type="file"]');

    // Create a hidden file input if missing
    if (uploadArea && !fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.bin';
        fileInput.id = 'firmwareFile';
        uploadArea.appendChild(fileInput);
    }

    // Ensure file input is hidden (we trigger it programmatically from the drop zone)
    if (fileInput) {
        fileInput.style.display = 'none';
    }

    if (uploadArea && fileInput) {
        // File upload drag and drop
        uploadArea.addEventListener('click', (e) => {
            // If the native file input was the target, let the browser handle it once
            const t = e?.target;
            if (t && t.tagName === 'INPUT' && t.type === 'file') {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            if (fileInput) fileInput.click();
        });
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);

        fileInput.addEventListener('change', handleFileSelect);
    }

    // Persist firmware version across refreshes/tabs
    const versionInput = document.getElementById('firmwareVersion') || document.querySelector('input#firmwareVersion, input[name="firmwareVersion"]');
    if (versionInput) {
        try {
            const saved = localStorage.getItem('otaVersion');
            if (saved && !versionInput.value) versionInput.value = saved;
        } catch(e) {}
        versionInput.addEventListener('input', () => {
            try { localStorage.setItem('otaVersion', versionInput.value || ''); } catch(e) {}
        });
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.bin')) {
        // Use the dropped file directly; do not try to assign to input.files (read-only in most browsers)
        selectedFirmwareFile = files[0];

        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) uploadArea.innerHTML = `<p>Selected: ${selectedFirmwareFile.name} (${formatFileSize(selectedFirmwareFile.size)})</p>`;

        const versionInput = document.getElementById('firmwareVersion');
        if (versionInput && !versionInput.value) {
            versionInput.value = selectedFirmwareFile.name.replace('.bin', '');
            try { localStorage.setItem('otaVersion', versionInput.value || ''); } catch(e) {}
        }
    }
}

function handleFileSelect() {
    const fileInput = document.getElementById('firmwareFile') || document.querySelector('input[type="file"]');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        selectedFirmwareFile = fileInput.files[0];
    }
    if (!selectedFirmwareFile) return;

    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) uploadArea.innerHTML = `<p>Selected: ${selectedFirmwareFile.name} (${formatFileSize(selectedFirmwareFile.size)})</p>`;

    // Auto-generate version name from filename
    const versionInput = document.getElementById('firmwareVersion');
    if (versionInput && !versionInput.value) {
        const baseName = selectedFirmwareFile.name.replace('.bin', '');
        versionInput.value = baseName;
        try { localStorage.setItem('otaVersion', versionInput.value || ''); } catch(e) {}
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadFirmware() {
    // Ensure a file input exists and is used
    const area = document.getElementById('uploadArea');
    let fileInput = document.getElementById('firmwareFile') || document.querySelector('input[type="file"]');
    if (!fileInput && area) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.bin';
        fileInput.id = 'firmwareFile';
        fileInput.style.position = 'absolute';
        fileInput.style.left = '-9999px';
        fileInput.style.width = '1px';
        fileInput.style.height = '1px';
        fileInput.style.opacity = '0';
        area.appendChild(fileInput);
        fileInput.addEventListener('change', handleFileSelect);
    }
    const versionInput = document.getElementById('firmwareVersion') || document.querySelector('input#firmwareVersion, input[name="firmwareVersion"]');
    const descriptionInput = document.getElementById('firmwareDescription') || document.querySelector('#firmwareDescription, input[name="firmwareDescription"]');

    // Defensive: ensure we're on the Firmware page
    if (!fileInput || !versionInput) {
        console.warn('Firmware upload UI elements not found on this page.');
        showAlert('Open Admin → Firmware to upload firmware.', 'error');
        return;
    }

    const chosenFile = selectedFirmwareFile || (fileInput.files && fileInput.files[0]);
    if (!chosenFile) {
        showAlert('Please select a firmware file', 'error');
        return;
    }

    let version = (versionInput.value || '').trim();
    if (!version) {
        const suggested = selectedFirmwareFile ? selectedFirmwareFile.name.replace('.bin','') : '';
        const entered = window.prompt('Enter firmware version (e.g., 1.0.2):', suggested);
        if (!entered) {
            showAlert('Upload cancelled: version required', 'error');
            return;
        }
        version = entered.trim();
        versionInput.value = version;
        try { localStorage.setItem('otaVersion', version || ''); } catch(e) {}
    }

    const formData = new FormData();
    formData.append('firmware', chosenFile);
    formData.append('version', version);
    formData.append('description', (descriptionInput?.value || '').trim());

    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');

    try {
        progressDiv?.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '0%';

        // Read file as base64 (Data URL) and strip prefix
        const base64 = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onerror = () => reject(new Error('file_read_error'));
            fr.onload = () => {
                const s = String(fr.result||'');
                const idx = s.indexOf('base64,');
                resolve(idx>=0 ? s.slice(idx+7) : s);
            };
            fr.readAsDataURL(chosenFile);
        });

        const response = await fetch(`${API_BASE}/api/ota/firmware/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version, dataBase64: base64, description: (descriptionInput?.value||'').trim() })
        });

        if (progressBar) progressBar.style.width = '100%';

        if (response.ok) {
            const result = await response.json();
            showAlert(`Firmware ${result.version} uploaded successfully!`, 'success');

            // Reset file selection and description; keep version (persisted)
            selectedFirmwareFile = null;
            if (fileInput) fileInput.value = '';
            if (descriptionInput) descriptionInput.value = '';
            const area = document.getElementById('uploadArea');
            if (area) area.innerHTML = '<p>Drag and drop a .bin file here, or click to select</p>';
            try { localStorage.setItem('otaVersion', (versionInput?.value || '')); } catch(e) {}

            // Reload firmware list
            loadFirmwareVersions();
        } else {
            let errorMsg = 'unknown_error';
            try { const err = await response.json(); errorMsg = err?.error || errorMsg; } catch {}
            showAlert(`Upload failed: ${errorMsg}`, 'error');
        }
    } catch (error) {
        showAlert(`Upload failed: ${error.message}`, 'error');
    } finally {
        setTimeout(() => {
            progressDiv?.classList.add('hidden');
        }, 2000);
    }
}

async function loadDevices() {
    try {
        const response = await fetch('/api/devices/list', { cache: 'no-store' });
        if (response.ok) {
            const data = await response.json();
            if (data && Object.keys(data).length > 0) {
                devices = data;
                window.__lastDevicesSnapshot = data;
                window.__devicesStale = false;
                window.__listErrorCount = 0;
            } else {
                window.__listErrorCount = (window.__listErrorCount || 0) + 1;
                if (window.__lastDevicesSnapshot && Object.keys(window.__lastDevicesSnapshot).length > 0 && window.__listErrorCount < 3) {
                    devices = window.__lastDevicesSnapshot;
                    window.__devicesStale = true;
                } else {
                    devices = data || {};
                    window.__devicesStale = false;
                }
            }
        } else {
            window.__listErrorCount = (window.__listErrorCount || 0) + 1;
            if (window.__lastDevicesSnapshot && Object.keys(window.__lastDevicesSnapshot).length > 0) {
                devices = window.__lastDevicesSnapshot;
                window.__devicesStale = true;
            }
        }
        renderDevices();
        updateStats();
        renderStaleBanner();
    } catch (error) {
        console.error('Failed to load devices:', error);
        window.__listErrorCount = (window.__listErrorCount || 0) + 1;
        if (window.__lastDevicesSnapshot && Object.keys(window.__lastDevicesSnapshot).length > 0) {
            devices = window.__lastDevicesSnapshot;
            window.__devicesStale = true;
            renderDevices();
            updateStats();
            renderStaleBanner();
        }
    }
}

async function loadFirmwareVersions() {
    try {
        const [listResp, activeResp] = await Promise.all([
            fetch(`${API_BASE}/api/ota/firmware/list`, { cache: 'no-store' }),
            fetch(`${API_BASE}/api/ota/firmware/active`, { cache: 'no-store' })
        ]);
        if (listResp.ok) {
            firmwareVersions = await listResp.json();
        } else {
            firmwareVersions = [];
        }
        if (activeResp.ok) {
            const j = await activeResp.json();
            activeVersion = j?.version || null;
        } else {
            activeVersion = null;
        }
        renderFirmwareList();
    } catch (error) {
        console.error('Failed to load firmware versions:', error);
    }
}

async function clearAllDevices(){
    if (!confirm('Clear ALL registered devices? This cannot be undone.')) return;
    try {
        const r = await fetch('/api/devices/clear-all', { method: 'POST' });
        if (r.ok) {
            const j = await r.json().catch(()=>({}));
            showAlert(`Cleared ${j.cleared||0} devices`, 'success');
            if (document.getElementById('deviceList') || document.getElementById('totalDevices')) loadDevices();
        } else {
            const t = await r.text();
            showAlert(`Failed to clear devices: ${t||r.status}`, 'error');
        }
    } catch (e) {
        showAlert(`Failed to clear devices: ${e.message}`, 'error');
    }
}

function renderDevices() {
    const deviceList = document.getElementById('deviceList');
    if (!deviceList) return; // Not on devices page
    const deviceArray = Object.entries(devices);

    if (deviceArray.length === 0) {
        deviceList.innerHTML = '<p>No devices connected yet. Devices will appear here when they connect to WiFi.</p>';
        return;
    }

    deviceList.innerHTML = deviceArray.map(([deviceId, device]) => {
        const updStatus = (device.lastUpdateStatus || (device.updateAvailable ? 'not_updated' : 'updated')).toUpperCase();
        const updClass = updStatus === 'UPDATED' ? 'status-online' : 'status-offline';
        return `
        <div class="device-card ${device.status}">
            <h3>${device.name}</h3>
            <p><strong>MAC:</strong> ${device.mac}</p>
            <p><strong>Firmware (reported):</strong> ${device.firmware}</p>
            ${device.lastDownloaded ? `<p><strong>Downloaded:</strong> ${device.lastDownloaded} <small>at ${formatDate(device.lastDownloadedAt)}</small></p>` : ''}
            <p><strong>Status:</strong> <span class="device-status status-${device.status}">${device.status.toUpperCase()}</span></p>
            <p><strong>Last Seen:</strong> ${formatDate(device.lastSeen)}</p>
            <p><strong>Update Status:</strong> <span class="device-status ${updClass}">${updStatus}</span></p>
            <div style="margin-top: 1rem;">
                <button class="btn" onclick="openDeviceLogs('${device.mac}')">View Logs</button>
            </div>
            ${device.logs ? `<pre style="margin-top:8px; max-height:180px; overflow:auto; background:#0b0f1a; padding:8px; border-radius:6px; border:1px solid var(--border-color)">${device.logs.join('\n')}</pre>` : ''}
        </div>`;
    }).join('');
}

function renderFirmwareList() {
    const firmwareList = document.getElementById('firmwareList');

    if (firmwareVersions.length === 0) {
        firmwareList.innerHTML = '<p>No firmware versions uploaded yet.</p>';
        return;
    }

    // Determine active/current
    const idx = activeVersion ? firmwareVersions.findIndex(f => f.version === activeVersion) : -1;
    const current = idx >= 0 ? firmwareVersions[idx] : null;
    const past = firmwareVersions.filter((fw, i) => idx >= 0 ? i !== idx : true);

    let html = '';
    if (current) {
        html += `
        <div class="firmware-item" style="border-left:3px solid var(--primary)">
            <div>
                <div class="chip" style="margin-bottom:6px;">Active Update</div>
                <strong>${current.version}</strong><br>
                <small>${formatFileSize(current.size)} • ${formatDate(current.created)}</small>
                ${current.description ? `<div style='color:var(--text-muted); margin-top:4px;'>${current.description}</div>` : ''}
            </div>
            <div>
                <a class="btn" href="${API_BASE}/api/ota/firmware/${encodeURIComponent(current.version)}" target="_blank" rel="noopener">Download</a>
                <button class="btn btn-danger" onclick="deleteFirmware('${current.version}')">Delete</button>
            </div>
        </div>`;
    } else {
        html += `<div class="chip" style="margin-bottom:6px;">No Active Firmware Selected</div>`;
    }

    if (past.length) {
        html += `<h3 style="margin-top:12px;">${current ? 'Other Versions' : 'Available Versions'}</h3>`;
        html += past.map(firmware => `
            <div class="firmware-item">
                <div>
                    <strong>${firmware.version}</strong><br>
                    <small>${formatFileSize(firmware.size)} • ${formatDate(firmware.created)}</small>
                    ${firmware.description ? `<div style='color:var(--text-muted); margin-top:4px;'>${firmware.description}</div>` : ''}
                    ${firmware.ready ? `<div class='chip' style='margin-top:6px;'>Ready on server</div>` : `<div class='chip' style='margin-top:6px; opacity:.8;'>Caching…</div>`}
                </div>
                <div>
                    <a class="btn" href="${API_BASE}/api/ota/firmware/${encodeURIComponent(firmware.version)}" target="_blank" rel="noopener">Download</a>
                    ${firmware.ready ? `<button class="btn" onclick="makeActive('${firmware.version}')">Make Active</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteFirmware('${firmware.version}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // If there is no active and at least one version, show a quick action to activate newest
    if (!current && firmwareVersions.length > 0) {
        const newest = firmwareVersions[0];
        html = `
            <div class="firmware-item" style="border-left:3px solid var(--primary)">
                <div>
                    <div class="chip" style="margin-bottom:6px;">Newest (not active)</div>
                    <strong>${newest.version}</strong><br>
                    <small>${formatFileSize(newest.size)} • ${formatDate(newest.created)}</small>
                    ${newest.ready ? `<div class='chip' style='margin-top:6px;'>Ready on server</div>` : `<div class='chip' style='margin-top:6px; opacity:.8;'>Caching…</div>`}
                </div>
                <div>
                    <a class="btn" href="${API_BASE}/api/ota/firmware/${encodeURIComponent(newest.version)}" target="_blank" rel="noopener">Download</a>
                    ${newest.ready ? `<button class="btn" onclick="makeActive('${newest.version}')">Make Active</button>` : ''}
                </div>
            </div>
            <h3 style="margin-top:12px;">Other Versions</h3>
        ` + past.map(firmware => `
            <div class="firmware-item">
                <div>
                    <strong>${firmware.version}</strong><br>
                    <small>${formatFileSize(firmware.size)} • ${formatDate(firmware.created)}</small>
                    ${firmware.ready ? `<div class='chip' style='margin-top:6px;'>Ready on server</div>` : `<div class='chip' style='margin-top:6px; opacity:.8;'>Caching…</div>`}
                </div>
                <div>
                    <a class="btn" href="${API_BASE}/api/ota/firmware/${encodeURIComponent(firmware.version)}" target="_blank" rel="noopener">Download</a>
                    ${firmware.ready ? `<button class="btn" onclick="makeActive('${firmware.version}')">Make Active</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteFirmware('${firmware.version}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    firmwareList.innerHTML = html || '<p>No firmware versions uploaded yet.</p>';
}

function updateStats() {
    const deviceArray = Object.values(devices || {});
    const totalDevices = deviceArray.length;
    const onlineDevices = deviceArray.filter(d => d.status === 'online').length;
    const pendingUpdates = deviceArray.filter(d => d.updateAvailable).length;

    const totalEl = document.getElementById('totalDevices');
    const onlineEl = document.getElementById('onlineDevices');
    const pendingEl = document.getElementById('pendingUpdates');
    if (!totalEl || !onlineEl || !pendingEl) return; // Not on a page with stats

    totalEl.textContent = totalDevices;
    onlineEl.textContent = onlineDevices;
    pendingEl.textContent = pendingUpdates;
}

async function pushUpdateToDevice(deviceId) {
    const select = document.getElementById(`firmware-${deviceId}`);
    const version = select.value;

    if (!version) {
        showAlert('Please select a firmware version', 'error');
        return;
    }

    try {
        const response = await fetch('/api/ota/push-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: version,
                deviceIds: [deviceId]
            })
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(result.message, 'success');
            if (document.getElementById('deviceList') || document.getElementById('totalDevices')) loadDevices();
        } else {
            const error = await response.json().catch(() => ({}));
            const base = error.base ? ` @ ${error.base}` : '';
            const detail = error.detail ? ` - ${error.detail}` : '';
            showAlert(`Failed to push update: ${error.error || response.status}${base}${detail}`, 'error');
        }
    } catch (error) {
        showAlert(`Failed to push update: ${error.message}`, 'error');
    }
}

async function pushUpdateToAll(version) {
    if (!confirm(`Push firmware ${version} to ALL devices?`)) {
        return;
    }

    try {
        const response = await fetch('/api/ota/push-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: version,
                allDevices: true
            })
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(result.message, 'success');
            if (document.getElementById('deviceList') || document.getElementById('totalDevices')) loadDevices();
        } else {
            const error = await response.json().catch(() => ({}));
            const base = error.base ? ` @ ${error.base}` : '';
            const detail = error.detail ? ` - ${error.detail}` : '';
            showAlert(`Failed to push update: ${error.error || response.status}${base}${detail}`, 'error');
        }
    } catch (error) {
        showAlert(`Failed to push update: ${error.message}`, 'error');
    }
}

async function makeActive(version) {
    try {
        const resp = await fetch(`${API_BASE}/api/ota/firmware/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version })
        });
        if (resp.ok) {
            showAlert(`Activated ${version}`, 'success');
            await loadFirmwareVersions();
        } else {
            const j = await resp.json().catch(()=>({}));
            showAlert(`Failed to activate: ${j.error || resp.status}`, 'error');
        }
    } catch (e) {
        showAlert(`Failed to activate: ${e.message}`, 'error');
    }
}


async function cancelUpdate(deviceId) {
    try {
        const response = await fetch('/api/ota/cancel-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceIds: [deviceId]
            })
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(result.message, 'success');
            if (document.getElementById('deviceList') || document.getElementById('totalDevices')) loadDevices();
        } else {
            const error = await response.json();
            showAlert(`Failed to cancel update: ${error.error}`, 'error');
        }
    } catch (error) {
        showAlert(`Failed to cancel update: ${error.message}`, 'error');
    }
}

async function cancelAllUpdates() {
    if (!confirm('Cancel ALL pending updates?')) {
        return;
    }

    try {
        const response = await fetch('/api/ota/cancel-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                allDevices: true
            })
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(result.message, 'success');
            if (document.getElementById('deviceList') || document.getElementById('totalDevices')) loadDevices();
        } else {
            const error = await response.json();
            showAlert(`Failed to cancel updates: ${error.error}`, 'error');
        }
    } catch (error) {
        showAlert(`Failed to cancel updates: ${error.message}`, 'error');
    }
}

async function deleteFirmware(version) {
    if (!confirm(`Delete firmware ${version}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/ota/firmware/${encodeURIComponent(version)}`, {
            method: 'DELETE'
        });


        if (response.ok) {
            const result = await response.json();
            showAlert(result.message, 'success');
            loadFirmwareVersions();
        } else {
            const error = await response.json();
            showAlert(`Failed to delete firmware: ${error.error}`, 'error');
        }
    } catch (error) {
        showAlert(`Failed to delete firmware: ${error.message}`, 'error');
    }
}

async function clearAllFirmware() {
    if (!confirm('Delete ALL firmware versions from the server? This cannot be undone.')) return;
    try {
        const resp = await fetch(`${API_BASE}/api/ota/firmware/clear-all`, { method: 'DELETE' });
        if (resp.ok) {
            showAlert('All firmware deleted', 'success');
            loadFirmwareVersions();
        } else {
            const t = await resp.text();
            showAlert(`Failed to clear firmware: ${t || resp.status}`,'error');
        }
    } catch (e) {
        showAlert(`Failed to clear firmware: ${e.message}`, 'error');
    }
}

function refreshDevices() {
    loadDevices();
    showAlert('Device list refreshed', 'success');
}

function showAlert(message, type) {
    const alertDiv = document.getElementById('uploadAlert');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';

    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

async function viewLogs(mac) {
    try {
        const id = (mac||'').toLowerCase().replace(/:/g,'');
        // Simple refresh to pull latest device list (logs are embedded in device object)
        await loadDevices();
        const device = Object.values(devices).find(d => (d.mac||'').toLowerCase()===mac.toLowerCase());
        if (!device || !device.logs) {
            showAlert('No logs available yet for this device', 'error');
            return;
        }
        showAlert(`Loaded ${device.logs.length} log lines for ${mac}`, 'success');
    } catch (e) {
        console.error(e);
        showAlert('Failed to load logs', 'error');
    }
}

function renderStaleBanner() {
    const alertDiv = document.getElementById('uploadAlert');
    if (!alertDiv) return;
    if (window.__devicesStale) {
        alertDiv.className = 'alert alert-warning';
        alertDiv.textContent = 'Showing last known devices (connection unstable)...';
        alertDiv.style.display = 'block';
    } else {
        // Hide only if this banner set it
        if (alertDiv.textContent && alertDiv.textContent.indexOf('Showing last known devices') === 0) {
            alertDiv.style.display = 'none';
        }
    }
}


function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// CalcAI Dashboard JavaScript
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

    // Ensure file input is offscreen but clickable
    if (fileInput) {
        fileInput.style.position = 'absolute';
        fileInput.style.left = '-9999px';
        fileInput.style.width = '1px';
        fileInput.style.height = '1px';
        fileInput.style.opacity = '0';
    }

    if (uploadArea && fileInput) {
        // File upload drag and drop
        uploadArea.addEventListener('click', () => fileInput && fileInput.click());
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);

        fileInput.addEventListener('change', handleFileSelect);
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

    const version = (versionInput.value || '').trim();
    if (!version) {
        showAlert('Please enter a version name', 'error');
        return;
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

        const response = await fetch('/api/ota/upload', {
            method: 'POST',
            body: formData
        });

        if (progressBar) progressBar.style.width = '100%';

        if (response.ok) {
            const result = await response.json();
            showAlert(`Firmware ${result.version} uploaded successfully!`, 'success');

            // Reset form
            selectedFirmwareFile = null;
            if (fileInput) fileInput.value = '';
            if (versionInput) versionInput.value = '';
            if (descriptionInput) descriptionInput.value = '';
            const area = document.getElementById('uploadArea');
            if (area) area.innerHTML = '<p>Drag and drop a .bin file here, or click to select</p>';

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
        const response = await fetch('/api/ota/firmware/list');
        if (response.ok) {
            firmwareVersions = await response.json();
            renderFirmwareList();
        }
    } catch (error) {
        console.error('Failed to load firmware versions:', error);
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

    deviceList.innerHTML = deviceArray.map(([deviceId, device]) => `
        <div class="device-card ${device.status}">
            <h3>${device.name}</h3>
            <p><strong>MAC:</strong> ${device.mac}</p>
            <p><strong>Firmware:</strong> ${device.firmware}</p>
            <p><strong>Status:</strong> <span class="device-status status-${device.status}">${device.status.toUpperCase()}</span></p>
            <p><strong>Last Seen:</strong> ${formatDate(device.lastSeen)}</p>
            ${device.updateAvailable ? `<p><strong>Update Available:</strong> ${device.targetFirmware}</p>` : ''}

            <div style="margin-top: 1rem;">
                <select id="firmware-${deviceId}" style="margin-right: 0.5rem;">
                    <option value="">Select firmware...</option>
                    ${firmwareVersions.map(fw => `<option value="${fw.version}">${fw.version}</option>`).join('')}
                </select>
                <button class="btn" onclick="pushUpdateToDevice('${deviceId}')">Push Update</button>
                ${device.updateAvailable ? `<button class=\"btn btn-danger\" onclick=\"cancelUpdate('${deviceId}')\">Cancel Update</button>` : ''}
                <button class=\"btn\" onclick=\"openDeviceLogs('${device.mac}')\">View Logs</button>
            </div>
            ${device.logs ? `<pre style="margin-top:8px; max-height:180px; overflow:auto; background:#0b0f1a; padding:8px; border-radius:6px; border:1px solid var(--border-color)">${device.logs.join('\n')}</pre>` : ''}
        </div>
    `).join('');
}

function renderFirmwareList() {
    const firmwareList = document.getElementById('firmwareList');

    if (firmwareVersions.length === 0) {
        firmwareList.innerHTML = '<p>No firmware versions uploaded yet.</p>';
        return;
    }

    firmwareList.innerHTML = firmwareVersions.map(firmware => `
        <div class="firmware-item">
            <div>
                <strong>${firmware.version}</strong><br>
                <small>${formatFileSize(firmware.size)} • ${formatDate(firmware.created)}</small>
            </div>
            <div>
                <button class="btn" onclick="pushUpdateToAll('${firmware.version}')">Push to All</button>
                <button class="btn btn-danger" onclick="deleteFirmware('${firmware.version}')">Delete</button>
            </div>
        </div>
    `).join('');
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
            const error = await response.json();
            showAlert(`Failed to push update: ${error.error}`, 'error');
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
            const error = await response.json();
            showAlert(`Failed to push update: ${error.error}`, 'error');
        }
    } catch (error) {
        showAlert(`Failed to push update: ${error.message}`, 'error');
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
        const response = await fetch(`/api/ota/firmware/${version}`, {
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

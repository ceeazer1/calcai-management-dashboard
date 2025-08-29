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
    // initial load orders
    loadOrders();
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

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
    loadDevices();
    loadFirmwareVersions();

    // Auto-refresh every 30 seconds
    setInterval(() => {
        loadDevices();
    }, 30000);
});

// Check if user is authenticated
async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('username').textContent = data.username || 'Admin';
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
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
    const fileInput = document.getElementById('firmwareFile');

    // File upload drag and drop
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    fileInput.addEventListener('change', handleFileSelect);
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
        document.getElementById('firmwareFile').files = files;
        handleFileSelect();
    }
}

function handleFileSelect() {
    const fileInput = document.getElementById('firmwareFile');
    const file = fileInput.files[0];

    if (file) {
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.innerHTML = `<p>Selected: ${file.name} (${formatFileSize(file.size)})</p>`;

        // Auto-generate version name from filename
        const versionInput = document.getElementById('firmwareVersion');
        if (!versionInput.value) {
            const baseName = file.name.replace('.bin', '');
            versionInput.value = baseName;
        }
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
    const fileInput = document.getElementById('firmwareFile');
    const versionInput = document.getElementById('firmwareVersion');
    const descriptionInput = document.getElementById('firmwareDescription');
    const alertDiv = document.getElementById('uploadAlert');

    if (!fileInput.files[0]) {
        showAlert('Please select a firmware file', 'error');
        return;
    }

    if (!versionInput.value.trim()) {
        showAlert('Please enter a version name', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('firmware', fileInput.files[0]);
    formData.append('version', versionInput.value.trim());
    formData.append('description', descriptionInput.value.trim());

    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');

    try {
        progressDiv.classList.remove('hidden');
        progressBar.style.width = '0%';

        const response = await fetch('/api/ota/upload', {
            method: 'POST',
            body: formData
        });

        progressBar.style.width = '100%';

        if (response.ok) {
            const result = await response.json();
            showAlert(`Firmware ${result.version} uploaded successfully!`, 'success');

            // Reset form
            fileInput.value = '';
            versionInput.value = '';
            descriptionInput.value = '';
            document.getElementById('uploadArea').innerHTML = '<p>Drag and drop a .bin file here, or click to select</p>';

            // Reload firmware list
            loadFirmwareVersions();
        } else {
            const error = await response.json();
            showAlert(`Upload failed: ${error.error}`, 'error');
        }
    } catch (error) {
        showAlert(`Upload failed: ${error.message}`, 'error');
    } finally {
        setTimeout(() => {
            progressDiv.classList.add('hidden');
        }, 2000);
    }
}

async function loadDevices() {
    try {
        const response = await fetch('/api/devices/list');
        if (response.ok) {
            devices = await response.json();
            renderDevices();
            updateStats();
        }
    } catch (error) {
        console.error('Failed to load devices:', error);
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
    const deviceArray = Object.entries(devices);

    if (deviceArray.length === 0) {
        deviceList.innerHTML = '<p>No devices connected yet. Devices will appear here when they connect to WiFi.</p>';
        return;
    }

    deviceList.innerHTML = deviceArray.map(([deviceId, device]) => `
        <div class="device-card ${device.status}">
            <h3>${device.name}</h3>
            <p><strong>MAC:</strong> ${device.mac}</p>
            <p><strong>Model:</strong> ${device.model}</p>
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
                ${device.updateAvailable ? `<button class="btn btn-danger" onclick="cancelUpdate('${deviceId}')">Cancel Update</button>` : ''}
            </div>
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
    const deviceArray = Object.values(devices);
    const totalDevices = deviceArray.length;
    const onlineDevices = deviceArray.filter(d => d.status === 'online').length;
    const pendingUpdates = deviceArray.filter(d => d.updateAvailable).length;

    document.getElementById('totalDevices').textContent = totalDevices;
    document.getElementById('onlineDevices').textContent = onlineDevices;
    document.getElementById('pendingUpdates').textContent = pendingUpdates;
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
            loadDevices();
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
            loadDevices();
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
            loadDevices();
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
            loadDevices();
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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

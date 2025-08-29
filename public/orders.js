let ORDERS = [];

function showOrdersAlert(msg, type = 'error') {
  const el = document.getElementById('ordersAlert');
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 4000);
}

function formatDate(val) {
  try {
    const d = new Date(val);
    return d.toLocaleString();
  } catch {
    return String(val);
  }
}

function renderStatusBadge(status) {
  const cls = status === 'paid' || status === 'complete' || status === 'succeeded' ? 'status-online' : 'status-offline';
  return `<span class="device-status ${cls}" style="font-weight:600; text-transform:uppercase;">${status}</span>`;
}

async function loadOrders() {
  try {
    const res = await fetch('/api/orders/list');
    if (!res.ok) throw new Error('Failed to load orders');
    const data = await res.json();
    ORDERS = data.orders || [];
    renderOrders();
  } catch (e) {
    console.error(e);
    showOrdersAlert('Failed to load orders', 'error');
  }
}

function renderOrders() {
  const tbody = document.getElementById('ordersTable');
  const q = (document.getElementById('ordersSearch')?.value || '').toLowerCase();
  const status = (document.getElementById('ordersStatus')?.value || '').toLowerCase();
  const filtered = ORDERS.filter(o => {
    const matchesQ = !q || (o.customer||'').toLowerCase().includes(q) || (o.email||'').toLowerCase().includes(q);
    const matchesStatus = !status || (o.status||'').toLowerCase() === status;
    return matchesQ && matchesStatus;
  });
  tbody.innerHTML = filtered.map(o => `
    <tr>
      <td>${formatDate(o.date)}</td>
      <td>${o.customer || '—'}</td>
      <td>${o.email || '—'}</td>
      <td>$${Number(o.amount || 0).toFixed(2)} ${o.currency}</td>
      <td>${renderStatusBadge(o.status)}</td>
      <td class="actions">
        <button class="btn" onclick="viewOrder('${o.id}')">View</button>
        ${o.receipt_url ? `<a class="btn" href="${o.receipt_url}" target="_blank" rel="noopener">Receipt</a>` : ''}
      </td>
    </tr>
  `).join('');
}

async function viewOrder(id) {
  try {
    const res = await fetch(`/api/orders/${id}`);
    if (!res.ok) throw new Error('Not found');
    const o = await res.json();
    const panel = document.getElementById('orderDetails');
    const content = document.getElementById('orderDetailsContent');

    const items = (o.line_items || []).map(li => `
      <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border-color); padding:6px 0;">
        <span>${li.description} ${li.quantity ? `(x${li.quantity})` : ''}</span>
        <span>$${Number(li.amount_total/100 || 0).toFixed(2)} ${li.currency}</span>
      </div>
    `).join('');

    const pm = o.payment_method ? `${o.payment_method.brand?.toUpperCase()} •••• ${o.payment_method.last4}` : '—';

    content.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        <div><strong>Date:</strong> ${formatDate(o.date)}</div>
        <div><strong>Customer:</strong> ${o.customer || '—'}</div>
        <div><strong>Email:</strong> ${o.email || '—'}</div>
        <div><strong>Status:</strong> ${renderStatusBadge(o.status)}</div>
        <div><strong>Amount:</strong> $${Number(o.amount || 0).toFixed(2)} ${o.currency}</div>
        <div><strong>Payment:</strong> ${pm}</div>
      </div>
      <hr class="hr" />
      <div>
        <strong>Items</strong>
        <div style="margin-top:8px;">${items || '—'}</div>
      </div>
      ${o.receipt_url ? `<div style="margin-top:8px;"><a class="btn" href="${o.receipt_url}" target="_blank">Open Receipt</a></div>` : ''}
    `;

    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    showOrdersAlert('Failed to load order details', 'error');
  }
}

// Wire up events
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', loadOrders);
  document.getElementById('ordersSearch').addEventListener('input', renderOrders);
  document.getElementById('ordersStatus').addEventListener('change', renderOrders);
  loadOrders();
});


interface OrderItem {
  description: string;
  quantity: number;
  amount: number;
}

interface OrderConfirmationParams {
  to: string;
  customerName: string;
  orderId: string;
  amount: number;
  currency: string;
  items: OrderItem[];
  paymentMethod?: string;
  shippingMethod?: string;
  shippingAmount?: number;
  shippingCurrency?: string;
}

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(amt: number, cur: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase() }).format(amt / 100);
}

export async function sendOrderConfirmationEmail(params: OrderConfirmationParams): Promise<void> {
  const { to, customerName, orderId, amount, currency, items, paymentMethod, shippingMethod, shippingAmount, shippingCurrency } = params;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) { console.warn('[email] No RESEND_API_KEY'); return; }

  const fromEmail = process.env.ORDER_FROM_EMAIL || 'orders@calcai.cc';
  const fromName = process.env.ORDER_FROM_NAME || 'CalcAI';
  const logo = 'https://www.calcai.cc/logo.png';
  
  // Small icon URLs
  const iGear = 'https://img.icons8.com/ios-filled/24/999999/gear.png';
  const iShip = 'https://img.icons8.com/ios-filled/24/999999/delivery.png';
  const iHome = 'https://img.icons8.com/ios-filled/24/999999/home.png';
  const iDiscord = 'https://img.icons8.com/ios-filled/24/666666/discord-logo.png';
  const iTiktok = 'https://img.icons8.com/ios-filled/24/666666/tiktok.png';
  const iInsta = 'https://img.icons8.com/ios-filled/24/666666/instagram-new.png';

  const rows = items.map(i => `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#1a1a1a;font-size:15px">${i.quantity}× ${esc(i.description)}</td><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;color:#525252;font-size:15px">${fmt(i.amount, currency)}</td></tr>`).join('');
  
  const shipRow = shippingMethod && typeof shippingAmount === 'number' 
    ? `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;color:#1a1a1a;font-size:15px">Shipping — ${esc(shippingMethod)}</td><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;color:#525252;font-size:15px">${fmt(shippingAmount, shippingCurrency || currency)}</td></tr>` 
    : '';

  const pmHtml = paymentMethod ? `<p style="margin:0 0 16px;color:#525252;font-size:14px"><b style="color:#1a1a1a">Payment:</b> ${esc(paymentMethod)}</p>` : '';

  // Step icon helper - uses table for centering
  const stepIcon = (url: string) => `<table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#e5e5e5;border:2px solid #d4d4d4;border-radius:50%" class="step"><tr><td align="center" valign="middle" style="width:28px;height:28px"><img src="${url}" width="14" height="14" alt="" style="display:block"></td></tr></table>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"><style>@media(prefers-color-scheme:dark){.bg{background:#121212!important}.card{background:#1e1e1e!important}.t1{color:#f5f5f5!important}.t2{color:#e0e0e0!important}.t3{color:#a0a0a0!important}.bdr{border-color:#333!important}.box{background:#171717!important;border-color:#333!important}.soc{background:#252525!important;border-color:#333!important}.step{background:#2a2a2a!important;border-color:#404040!important}}@media(max-width:600px){.wrap{width:100%!important}.px{padding-left:16px!important;padding-right:16px!important}}</style></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" class="bg" bgcolor="#f5f5f5" style="background:#f5f5f5"><tr><td align="center" class="bg" style="padding:24px 12px"><table width="600" cellpadding="0" cellspacing="0" class="wrap card" bgcolor="#fff" style="max-width:600px;width:100%;background:#fff;border-radius:16px"><tr><td class="card" style="padding:24px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:16px"><img src="${logo}" width="100" alt="CalcAI" style="display:block;width:100px;height:auto"></td></tr><tr><td align="center" class="t1" style="padding-bottom:20px;border-bottom:1px solid #e5e5e5;color:#1a1a1a;font-size:28px;font-weight:800">Order Confirmed</td></tr></table><table width="100%" cellpadding="0" cellspacing="0" class="box" style="margin:20px 0;background:#fafafa;border:1px solid #e5e5e5;border-radius:12px"><tr><td style="padding:14px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td width="50" align="center" valign="middle"><table cellpadding="0" cellspacing="0" style="width:28px;height:28px;background:#22c55e;border-radius:50%"><tr><td align="center" valign="middle" style="width:28px;height:28px;color:#fff;font-size:14px;font-weight:700">✓</td></tr></table></td><td valign="middle"><div style="height:3px;background:linear-gradient(90deg,#22c55e,#d4d4d4);border-radius:3px"></div></td><td width="50" align="center" valign="middle">${stepIcon(iGear)}</td><td valign="middle"><div class="bdr" style="height:3px;background:#d4d4d4;border-radius:3px"></div></td><td width="50" align="center" valign="middle">${stepIcon(iShip)}</td><td valign="middle"><div class="bdr" style="height:3px;background:#d4d4d4;border-radius:3px"></div></td><td width="50" align="center" valign="middle">${stepIcon(iHome)}</td></tr><tr><td align="center" style="padding-top:6px;color:#22c55e;font-size:11px;font-weight:700">Placed</td><td></td><td align="center" class="t3" style="padding-top:6px;color:#737373;font-size:11px;font-weight:700">Process</td><td></td><td align="center" class="t3" style="padding-top:6px;color:#737373;font-size:11px;font-weight:700">Shipped</td><td></td><td align="center" class="t3" style="padding-top:6px;color:#737373;font-size:11px;font-weight:700">Delivered</td></tr></table></td></tr></table><p class="t2" style="margin:0 0 12px;color:#1a1a1a;font-size:18px;font-weight:700">Hi ${esc(customerName)},</p><p class="t3" style="margin:0 0 16px;color:#525252;font-size:15px;line-height:1.6">Thank you for your order. We will start processing in 1-2 days.</p><div class="box" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:10px;padding:12px;margin-bottom:16px"><div class="t3" style="color:#737373;font-size:11px;text-transform:uppercase;font-weight:700">Order ID</div><div class="t2" style="margin-top:4px;color:#1a1a1a;font-size:14px;font-family:monospace">${esc(orderId)}</div></div>${pmHtml}<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr class="bdr" style="border-bottom:1px solid #e5e5e5"><th align="left" class="t3" style="padding:10px 0;color:#737373;font-size:11px;font-weight:700;text-transform:uppercase">Item</th><th align="right" class="t3" style="padding:10px 0;color:#737373;font-size:11px;font-weight:700;text-transform:uppercase">Amount</th></tr>${rows}${shipRow}<tr class="bdr" style="border-top:1px solid #e5e5e5"><td class="t1" style="padding:14px 0;font-weight:800;color:#1a1a1a;font-size:15px">Total</td><td align="right" class="t1" style="padding:14px 0;font-weight:900;color:#1a1a1a;font-size:20px">${fmt(amount, currency)}</td></tr></table><div class="bdr" style="border-top:1px solid #e5e5e5;padding-top:16px;text-align:center"><a href="https://discord.gg/calcai" style="display:inline-block;margin:0 4px;text-decoration:none"><table cellpadding="0" cellspacing="0" class="soc" style="width:32px;height:32px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:50%"><tr><td align="center" valign="middle"><img src="${iDiscord}" width="16" height="16" alt="Discord"></td></tr></table></a><a href="https://www.tiktok.com/@calc_ai" style="display:inline-block;margin:0 4px;text-decoration:none"><table cellpadding="0" cellspacing="0" class="soc" style="width:32px;height:32px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:50%"><tr><td align="center" valign="middle"><img src="${iTiktok}" width="16" height="16" alt="TikTok"></td></tr></table></a><a href="https://instagram.com/calc.ai" style="display:inline-block;margin:0 4px;text-decoration:none"><table cellpadding="0" cellspacing="0" class="soc" style="width:32px;height:32px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:50%"><tr><td align="center" valign="middle"><img src="${iInsta}" width="16" height="16" alt="Instagram"></td></tr></table></a><p class="t3" style="margin:12px 0 0;color:#a3a3a3;font-size:11px"><a href="https://calcai.cc" style="color:#a3a3a3;text-decoration:none">calcai.cc</a> · ${new Date().getFullYear()} CalcAI</p></div></td></tr></table></td></tr></table></body></html>`;

  const text = `Order Confirmed\n\nHi ${customerName},\n\nThank you for your order. We will start processing in 1-2 days.\n\nOrder ID: ${orderId}\n${paymentMethod ? `Payment: ${paymentMethod}\n` : ''}\n${items.map(i => `${i.quantity}x ${i.description}: ${fmt(i.amount, currency)}`).join('\n')}\n${shippingMethod ? `Shipping: ${shippingMethod} ${fmt(shippingAmount!, shippingCurrency || currency)}\n` : ''}\nTotal: ${fmt(amount, currency)}\n\ncalcai.cc`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject: `Order Confirmed - CalcAI #${orderId.slice(-8).toUpperCase()}`, html, text }),
  });

  if (!res.ok) { console.error('[email] Error:', await res.text()); throw new Error(`Email failed: ${res.status}`); }
  console.log('[email] Sent:', (await res.json()).id);
}

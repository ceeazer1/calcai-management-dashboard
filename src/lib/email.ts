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
  shippingAmount?: number; // cents
  shippingCurrency?: string;
}

function escapeHtml(input: string): string {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export async function sendOrderConfirmationEmail(params: OrderConfirmationParams): Promise<void> {
  const { to, customerName, orderId, amount, currency, items, paymentMethod, shippingMethod, shippingAmount, shippingCurrency } = params;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return;
  }

  const fromEmail = process.env.ORDER_FROM_EMAIL || 'orders@calcai.cc';
  const fromName = process.env.ORDER_FROM_NAME || 'CalcAI';
  const logoUrl = (process.env.ORDER_LOGO_URL || '').trim() || 'https://www.calcai.cc/logo.png';
  
  // Light icons for light theme (will be inverted on mobile)
  const discordIconUrl = 'https://img.icons8.com/ios-filled/50/1a1a1a/discord-logo.png';
  const tiktokIconUrl = 'https://img.icons8.com/ios-filled/50/1a1a1a/tiktok.png';
  const instagramIconUrl = 'https://img.icons8.com/ios-filled/50/1a1a1a/instagram-new--v1.png';
  const iconProcessingUrl = 'https://img.icons8.com/ios-filled/50/1a1a1a/gear.png';
  const iconShippedUrl = 'https://img.icons8.com/ios-filled/50/1a1a1a/delivery.png';
  const iconDeliveredUrl = 'https://img.icons8.com/ios-filled/50/1a1a1a/home.png';

  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td class="itemCell" style="padding:14px 0; border-bottom:1px solid #e5e5e5; color:#1a1a1a; font-size:16px; line-height:1.4;">${Number(item.quantity) || 1}× ${escapeHtml(item.description || 'Item')}</td>
          <td class="itemPrice" style="padding:14px 0; border-bottom:1px solid #e5e5e5; text-align:right; color:#525252; font-size:16px;">${formatCurrency(Number(item.amount) || 0, currency)}</td>
        </tr>`
    )
    .join('');

  const shippingRowHtml =
    shippingMethod && typeof shippingAmount === 'number'
      ? `<tr>
          <td class="itemCell" style="padding:14px 0; border-bottom:1px solid #e5e5e5; color:#1a1a1a; font-size:16px;">Shipping — ${escapeHtml(shippingMethod)}</td>
          <td class="itemPrice" style="padding:14px 0; border-bottom:1px solid #e5e5e5; text-align:right; color:#525252; font-size:16px;">${formatCurrency(shippingAmount, shippingCurrency || currency)}</td>
        </tr>`
      : '';

  // LIGHT THEME BASE - Gmail mobile will invert to dark
  // CSS media query will make desktop dark mode see dark theme
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Order Confirmation</title>
  <style>
    :root { color-scheme: light dark; }
    .stepLabel { text-transform: none !important; letter-spacing: 0 !important; }
    .labelFull { display: inline; }
    .labelShort { display: none; }
    @media (prefers-color-scheme: dark) {
      .body-wrap { background-color: #121212 !important; }
      .card { background-color: #1e1e1e !important; }
      .card-inner { background-color: #171717 !important; }
      .border-b { border-color: #333333 !important; }
      .title { color: #f5f5f5 !important; }
      .greeting { color: #e0e0e0 !important; }
      .bodycopy { color: #a0a0a0 !important; }
      .orderbox { background-color: #171717 !important; border-color: #333333 !important; }
      .orderid { color: #e0e0e0 !important; }
      .label { color: #808080 !important; }
      .itemCell { color: #e0e0e0 !important; border-color: #333333 !important; }
      .itemPrice { color: #a0a0a0 !important; border-color: #333333 !important; }
      .totalLabel { color: #f5f5f5 !important; }
      .totalAmt { color: #f5f5f5 !important; }
      .socialBtn { background-color: #252525 !important; border-color: #333333 !important; }
      .footer { color: #606060 !important; }
      .stepInactive { background-color: #2a2a2a !important; border-color: #404040 !important; }
      .stepLabelInactive { color: #b0b0b0 !important; }
      .progressLine { background-color: #404040 !important; }
    }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px { padding-left: 16px !important; padding-right: 16px !important; }
      .title { font-size: 30px !important; }
      .greeting { font-size: 20px !important; }
      .bodycopy { font-size: 16px !important; }
      .tot { font-size: 22px !important; }
      .stepLabel { font-size: 11px !important; }
      .labelFull { display: none !important; }
      .labelShort { display: inline !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div class="body-wrap" style="background-color:#f5f5f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="body-wrap" bgcolor="#f5f5f5" style="background-color:#f5f5f5;">
    <tr>
      <td align="center" class="body-wrap" bgcolor="#f5f5f5" style="padding:24px 12px; background-color:#f5f5f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="container card" bgcolor="#ffffff" style="width:100%; max-width:600px; background-color:#ffffff; border-radius:20px;">
          <tr>
            <td class="card" bgcolor="#ffffff" style="background-color:#ffffff; border-radius:20px;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" class="px" style="padding:28px 28px 14px;">
                    <img src="${escapeHtml(logoUrl)}" width="120" alt="CalcAI" style="display:block; width:120px; max-width:120px; height:auto; border:0;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" class="px border-b" style="padding:0 28px 20px; border-bottom:1px solid #e5e5e5;">
                    <h1 class="title" style="margin:0; color:#1a1a1a; font-size:34px; font-weight:800;">Order Confirmed</h1>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card-inner border-b" bgcolor="#fafafa" style="background-color:#fafafa; border-bottom:1px solid #e5e5e5;">
                <tr>
                  <td class="px" style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="34" height="34" align="center" valign="middle" style="background-color:#22c55e; border-radius:999px;">
                                <span style="color:#ffffff; font-size:16px; line-height:34px; font-weight:900;">✓</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="center" valign="middle">
                          <div class="progressLine" style="height:4px; background:linear-gradient(90deg,#22c55e 0%,#d4d4d4 100%); border-radius:999px;">&nbsp;</div>
                        </td>
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td class="stepInactive" width="34" height="34" align="center" valign="middle" style="background-color:#e5e5e5; border:2px solid #d4d4d4; border-radius:999px;">
                                <img src="${escapeHtml(iconProcessingUrl)}" width="16" height="16" alt="" style="display:block; width:16px; height:16px; opacity:0.7;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="center" valign="middle">
                          <div class="progressLine" style="height:4px; background-color:#d4d4d4; border-radius:999px;">&nbsp;</div>
                        </td>
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td class="stepInactive" width="34" height="34" align="center" valign="middle" style="background-color:#e5e5e5; border:2px solid #d4d4d4; border-radius:999px;">
                                <img src="${escapeHtml(iconShippedUrl)}" width="16" height="16" alt="" style="display:block; width:16px; height:16px; opacity:0.7;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td align="center" valign="middle">
                          <div class="progressLine" style="height:4px; background-color:#d4d4d4; border-radius:999px;">&nbsp;</div>
                        </td>
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td class="stepInactive" width="34" height="34" align="center" valign="middle" style="background-color:#e5e5e5; border:2px solid #d4d4d4; border-radius:999px;">
                                <img src="${escapeHtml(iconDeliveredUrl)}" width="16" height="16" alt="" style="display:block; width:16px; height:16px; opacity:0.7;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
                      <tr>
                        <td width="44" align="center" valign="top">
                          <div class="stepLabel" style="color:#22c55e; font-size:13px; font-weight:800;">Order Placed</div>
                        </td>
                        <td>&nbsp;</td>
                        <td width="44" align="center" valign="top">
                          <div class="stepLabel stepLabelInactive" style="color:#737373; font-size:13px; font-weight:800;">
                            <span class="labelFull">Processing</span><span class="labelShort">Process</span>
                          </div>
                        </td>
                        <td>&nbsp;</td>
                        <td width="44" align="center" valign="top">
                          <div class="stepLabel stepLabelInactive" style="color:#737373; font-size:13px; font-weight:800;">Shipped</div>
                        </td>
                        <td>&nbsp;</td>
                        <td width="44" align="center" valign="top">
                          <div class="stepLabel stepLabelInactive" style="color:#737373; font-size:13px; font-weight:800;">
                            <span class="labelFull">Delivered</span><span class="labelShort">Deliv.</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" bgcolor="#ffffff" style="background-color:#ffffff;">
                <tr>
                  <td class="px card" bgcolor="#ffffff" style="padding:26px 28px 10px; background-color:#ffffff;">
                    <p class="greeting" style="margin:0 0 16px; color:#1a1a1a; font-size:22px; font-weight:700;">Hi ${escapeHtml(customerName)},</p>
                    <p class="bodycopy" style="margin:0 0 18px; color:#525252; font-size:18px; line-height:1.7;">Thank you for your order. We Will start processing in 1-2 days.</p>

                    <div class="orderbox" style="background-color:#fafafa; border:1px solid #e5e5e5; border-radius:14px; padding:14px; margin:0 0 18px;">
                      <div class="label" style="color:#737373; font-size:13px; text-transform:uppercase; letter-spacing:0.55px; font-weight:700;">Order ID</div>
                      <div class="orderid" style="margin-top:6px; color:#1a1a1a; font-size:16px; font-family:monospace;">${escapeHtml(orderId)}</div>
                    </div>

                    ${paymentMethod ? `<div style="margin:0 0 18px; font-size:16px;"><span class="label" style="color:#737373; font-size:13px; text-transform:uppercase; letter-spacing:0.55px; font-weight:700;">Payment method:</span><span class="orderid" style="color:#1a1a1a; font-weight:700;"> ${escapeHtml(paymentMethod)}</span></div>` : ""}

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                      <thead>
                        <tr class="border-b" style="border-bottom:1px solid #e5e5e5;">
                          <th align="left" class="label" style="padding:12px 0; color:#737373; font-size:13px; font-weight:800; text-transform:uppercase;">Item</th>
                          <th align="right" class="label" style="padding:12px 0; color:#737373; font-size:13px; font-weight:800; text-transform:uppercase;">Amount</th>
                        </tr>
                      </thead>
                      <tbody>${itemsHtml}${shippingRowHtml}</tbody>
                      <tfoot>
                        <tr class="border-b" style="border-top:1px solid #e5e5e5;">
                          <td class="totalLabel" style="padding:16px 0; font-weight:800; color:#1a1a1a; font-size:16px;">Total</td>
                          <td align="right" class="totalAmt tot" style="padding:16px 0; font-weight:900; color:#1a1a1a; font-size:24px;">${formatCurrency(amount, currency)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    <div class="border-b" style="border-top:1px solid #e5e5e5; padding-top:16px; margin-top:10px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                        <tr>
                          <td style="padding:0 10px 0 0;">
                            <a href="https://discord.gg/calcai" style="text-decoration:none;">
                              <span class="socialBtn" style="display:inline-block; width:40px; height:40px; border-radius:999px; background-color:#f5f5f5; border:1px solid #e5e5e5; text-align:center;">
                                <img src="${escapeHtml(discordIconUrl)}" width="20" height="20" alt="Discord" style="display:block; width:20px; height:20px; margin:10px auto; border:0;" />
                              </span>
                            </a>
                          </td>
                          <td style="padding:0 10px 0 0;">
                            <a href="https://www.tiktok.com/@calc_ai" style="text-decoration:none;">
                              <span class="socialBtn" style="display:inline-block; width:40px; height:40px; border-radius:999px; background-color:#f5f5f5; border:1px solid #e5e5e5; text-align:center;">
                                <img src="${escapeHtml(tiktokIconUrl)}" width="20" height="20" alt="TikTok" style="display:block; width:20px; height:20px; margin:10px auto; border:0;" />
                              </span>
                            </a>
                          </td>
                          <td style="padding:0;">
                            <a href="https://instagram.com/calc.ai" style="text-decoration:none;">
                              <span class="socialBtn" style="display:inline-block; width:40px; height:40px; border-radius:999px; background-color:#f5f5f5; border:1px solid #e5e5e5; text-align:center;">
                                <img src="${escapeHtml(instagramIconUrl)}" width="20" height="20" alt="Instagram" style="display:block; width:20px; height:20px; margin:10px auto; border:0;" />
                              </span>
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:14px; text-align:center;">
                        <a href="https://calcai.cc" class="footer" style="color:#a3a3a3; font-size:12px; text-decoration:none;">calcai.cc</a>
                      </div>
                      <div class="footer" style="margin-top:8px; text-align:center; color:#a3a3a3; font-size:12px;">${new Date().getFullYear()} CalcAI. All rights reserved.</div>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  </div>
</body>
</html>
`;

  const textContent = `Order Confirmed\n\nHi ${customerName},\n\nThank you for your order. We Will start processing in 1-2 days.\n\nOrder ID: ${orderId}\n${paymentMethod ? `Payment method: ${paymentMethod}\n` : ''}\nItems:\n${items.map((item) => `- ${item.quantity}x ${item.description}: ${formatCurrency(item.amount, currency)}`).join('\n')}\n${shippingMethod && typeof shippingAmount === 'number' ? `- Shipping — ${shippingMethod}: ${formatCurrency(shippingAmount, shippingCurrency || currency)}\n` : ''}\nTotal: ${formatCurrency(amount, currency)}\n\nDiscord: https://discord.gg/calcai\nTikTok: https://www.tiktok.com/@calc_ai\nInstagram: https://instagram.com/calc.ai\n\ncalcai.cc\n${new Date().getFullYear()} CalcAI. All rights reserved.`;

  const htmlOut = html.replace(/\r?\n/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Order Confirmed - CalcAI #${orderId.slice(-8).toUpperCase()}`,
      html: htmlOut,
      text: textContent,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('[email] Resend API error:', errorData);
    throw new Error(`Email send failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('[email] Sent confirmation email:', result.id);
}

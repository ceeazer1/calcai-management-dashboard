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

  // Use Resend for email sending
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return;
  }

  const fromEmail = process.env.ORDER_FROM_EMAIL || 'orders@calcai.cc';
  const fromName = process.env.ORDER_FROM_NAME || 'CalcAI';

  // Email clients require absolute URLs for images.
  // Set ORDER_LOGO_URL to your uploaded logo (recommended).
  // Default: website logo (known-good).
  // Note: previous fallback used the dashboard /logo.png which is 404 in production.
  const logoUrl = (process.env.ORDER_LOGO_URL || '').trim() || 'https://www.calcai.cc/logo.png';
  // Social icon image URLs (PNG recommended for email clients; many block SVG).
  // You can override via env if you host your own icons.
  const discordIconUrl =
    (process.env.ORDER_ICON_DISCORD_URL || '').trim() ||
    'https://img.icons8.com/ios-filled/50/ffffff/discord-logo.png';
  const tiktokIconUrl =
    (process.env.ORDER_ICON_TIKTOK_URL || '').trim() ||
    'https://img.icons8.com/ios-filled/50/ffffff/tiktok.png';
  const instagramIconUrl =
    (process.env.ORDER_ICON_INSTAGRAM_URL || '').trim() ||
    'https://img.icons8.com/ios-filled/50/ffffff/instagram-new--v1.png';

  // Progress step icons (email-safe PNGs). Override via env if you host your own.
  const iconProcessingUrl =
    (process.env.ORDER_ICON_PROGRESS_PROCESSING_URL || '').trim() ||
    'https://img.icons8.com/ios-filled/50/ffffff/gear.png';
  const iconShippedUrl =
    (process.env.ORDER_ICON_PROGRESS_SHIPPED_URL || '').trim() ||
    'https://img.icons8.com/ios-filled/50/ffffff/delivery.png';
  const iconDeliveredUrl =
    (process.env.ORDER_ICON_PROGRESS_DELIVERED_URL || '').trim() ||
    'https://img.icons8.com/ios-filled/50/ffffff/home.png';

  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:14px 0; border-bottom:1px solid #262626; color:#e5e5e5; font-size:16px; line-height:1.4; word-break:break-word;">${Number(item.quantity) || 1}× ${escapeHtml(item.description || 'Item')}</td>
          <td style="padding:14px 0; border-bottom:1px solid #262626; text-align:right; color:#a3a3a3; font-size:16px; line-height:1.4; white-space:nowrap;">${formatCurrency(Number(item.amount) || 0, currency)}</td>
        </tr>`
    )
    .join('');

  const shippingRowHtml =
    shippingMethod && typeof shippingAmount === 'number'
      ? `<tr>
          <td style="padding:14px 0; border-bottom:1px solid #262626; color:#e5e5e5; font-size:16px; line-height:1.4; word-break:break-word;">Shipping — ${escapeHtml(shippingMethod)}</td>
          <td style="padding:14px 0; border-bottom:1px solid #262626; text-align:right; color:#a3a3a3; font-size:16px; line-height:1.4; white-space:nowrap;">${formatCurrency(shippingAmount, shippingCurrency || currency)}</td>
        </tr>`
      : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
    .stepLabel { text-transform: none !important; letter-spacing: 0 !important; }
    .labelFull { display: inline; }
    .labelShort { display: none; }
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
<body style="margin:0; padding:0; background-color:#0a0a0a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="container" style="width:100%; max-width:600px;">
          <tr>
            <td style="background-color:#171717; border:1px solid #262626; border-radius:20px;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" class="px" style="padding:28px 28px 14px;">
                    <img src="${escapeHtml(logoUrl)}" width="120" alt="CalcAI" style="display:block; width:120px; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" class="px" style="padding:0 28px 20px; border-bottom:1px solid #262626;">
                    <h1 class="title" style="margin:0; color:#ffffff; font-size:34px; font-weight:800; letter-spacing:0.2px;">Order Confirmed</h1>
                  </td>
                </tr>
              </table>

              <!-- Tracking -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f; border-bottom:1px solid #262626;">
                <tr>
                  <td class="px" style="padding:18px 22px;">
                    <!-- Progress line BETWEEN icons (single row) -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Icon 1 -->
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="34" height="34" align="center" valign="middle" style="background-color:#22c55e; border-radius:999px;">
                                <span style="color:#ffffff; font-size:16px; line-height:34px; font-weight:900;">✓</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- Line 1 -->
                        <td align="center" valign="middle">
                          <div style="height:4px; background:linear-gradient(90deg,#22c55e 0%,#404040 100%); border-radius:999px;">&nbsp;</div>
                        </td>
                        <!-- Icon 2 -->
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="34" height="34" align="center" valign="middle" style="background-color:#262626; border:2px solid #404040; border-radius:999px;">
                                <img src="${escapeHtml(iconProcessingUrl)}" width="16" height="16" alt="Processing" style="display:block; width:16px; height:16px; border:0; outline:none; text-decoration:none; opacity:0.9;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- Line 2 -->
                        <td align="center" valign="middle">
                          <div style="height:4px; background-color:#404040; border-radius:999px;">&nbsp;</div>
                        </td>
                        <!-- Icon 3 -->
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="34" height="34" align="center" valign="middle" style="background-color:#262626; border:2px solid #404040; border-radius:999px;">
                                <img src="${escapeHtml(iconShippedUrl)}" width="16" height="16" alt="Shipped" style="display:block; width:16px; height:16px; border:0; outline:none; text-decoration:none; opacity:0.9;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- Line 3 -->
                        <td align="center" valign="middle">
                          <div style="height:4px; background-color:#404040; border-radius:999px;">&nbsp;</div>
                        </td>
                        <!-- Icon 4 -->
                        <td width="44" align="center" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="34" height="34" align="center" valign="middle" style="background-color:#262626; border:2px solid #404040; border-radius:999px;">
                                <img src="${escapeHtml(iconDeliveredUrl)}" width="16" height="16" alt="Delivered" style="display:block; width:16px; height:16px; border:0; outline:none; text-decoration:none; opacity:0.9;" />
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Labels (separate row, will wrap nicely on mobile) -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px; table-layout:fixed;">
                      <tr>
                        <td width="25%" align="center">
                          <div class="stepLabel" style="color:#22c55e; font-size:13px; font-weight:800;">Order Placed</div>
                        </td>
                        <td width="25%" align="center">
                          <div class="stepLabel" style="color:#b3b3b3; font-size:13px; font-weight:800;">
                            <span class="labelFull">Processing</span><span class="labelShort">Process</span>
                          </div>
                        </td>
                        <td width="25%" align="center">
                          <div class="stepLabel" style="color:#b3b3b3; font-size:13px; font-weight:800;">Shipped</div>
                        </td>
                        <td width="25%" align="center">
                          <div class="stepLabel" style="color:#b3b3b3; font-size:13px; font-weight:800;">
                            <span class="labelFull">Delivered</span><span class="labelShort">Deliv.</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="px" style="padding:26px 28px 10px;">
                    <p class="greeting" style="margin:0 0 16px; color:#e5e5e5; font-size:22px; line-height:1.55; font-weight:700;">Hi ${escapeHtml(customerName)},</p>
                    <p class="bodycopy" style="margin:0 0 18px; color:#a3a3a3; font-size:18px; line-height:1.7;">Thank you for your order. We Will start processing in 1-2 days.</p>

                    <div style="background-color:#0f0f0f; border:1px solid #262626; border-radius:14px; padding:14px; margin:0 0 18px;">
                      <div style="color:#737373; font-size:13px; text-transform:uppercase; letter-spacing:0.55px; font-weight:700;">Order ID</div>
                      <div style="margin-top:6px; color:#e5e5e5; font-size:16px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(orderId)}</div>
                    </div>

                    ${
                      paymentMethod
                        ? `<div style="margin:0 0 18px; color:#e5e5e5; font-size:16px; line-height:1.6;">
                            <span style="color:#737373; font-size:13px; text-transform:uppercase; letter-spacing:0.55px; font-weight:700;">Payment method:</span>
                            <span style="color:#e5e5e5; font-weight:700;"> ${escapeHtml(paymentMethod)}</span>
                          </div>`
                        : ""
                    }

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:14px;">
                      <thead>
                        <tr style="border-bottom:1px solid #262626;">
                          <th align="left" style="padding:12px 0; color:#737373; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.55px;">Item</th>
                          <th align="right" style="padding:12px 0; color:#737373; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.55px;">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                        ${shippingRowHtml}
                      </tbody>
                      <tfoot>
                        <tr style="border-top:1px solid #262626;">
                          <td style="padding:16px 0; font-weight:800; color:#ffffff; font-size:16px;">Total</td>
                          <td align="right" class="tot" style="padding:16px 0; font-weight:900; color:#ffffff; font-size:24px; white-space:nowrap;">${formatCurrency(amount, currency)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    <!-- Social icons at bottom -->
                    <div style="border-top:1px solid #262626; padding-top:16px; margin-top:10px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                        <tr>
                          <td style="padding:0 10px 0 0;">
                            <a href="https://discord.gg/calcai" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                              <span style="display:inline-block; width:40px; height:40px; border-radius:999px; background-color:#171717; border:1px solid #262626; text-align:center;">
                                <img src="${escapeHtml(discordIconUrl)}" width="20" height="20" alt="Discord" style="display:block; width:20px; height:20px; margin:10px auto; border:0; outline:none; text-decoration:none;" />
                              </span>
                            </a>
                          </td>
                          <td style="padding:0 10px 0 0;">
                            <a href="https://www.tiktok.com/@calc_ai" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                              <span style="display:inline-block; width:40px; height:40px; border-radius:999px; background-color:#171717; border:1px solid #262626; text-align:center;">
                                <img src="${escapeHtml(tiktokIconUrl)}" width="20" height="20" alt="TikTok" style="display:block; width:20px; height:20px; margin:10px auto; border:0; outline:none; text-decoration:none;" />
                              </span>
                            </a>
                          </td>
                          <td style="padding:0;">
                            <a href="https://instagram.com/calc.ai" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                              <span style="display:inline-block; width:40px; height:40px; border-radius:999px; background-color:#171717; border:1px solid #262626; text-align:center;">
                                <img src="${escapeHtml(instagramIconUrl)}" width="20" height="20" alt="Instagram" style="display:block; width:20px; height:20px; margin:10px auto; border:0; outline:none; text-decoration:none;" />
                              </span>
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:14px; text-align:center; color:#525252; font-size:13px;">${new Date().getFullYear()} CalcAI. All rights reserved.</div>
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
</body>
</html>
`;

  const textContent = `
Order Confirmed

Hi ${customerName},

Thank you for your order. We Will start processing in 1-2 days.

ORDER STATUS:
[✓] Order Placed  ->  [ ] Processing  ->  [ ] Shipped  ->  [ ] Delivered

Order ID: ${orderId}

${paymentMethod ? `Payment method: ${paymentMethod}\n` : ''}

Items:
${items.map((item) => `- ${item.quantity}x ${item.description}: ${formatCurrency(item.amount, currency)}`).join('\n')}
${shippingMethod && typeof shippingAmount === 'number' ? `- Shipping — ${shippingMethod}: ${formatCurrency(shippingAmount, shippingCurrency || currency)}\n` : ''}

Total: ${formatCurrency(amount, currency)}

Discord: https://discord.gg/calcai
TikTok: https://www.tiktok.com/@calc_ai
Instagram: https://instagram.com/calc.ai

${new Date().getFullYear()} CalcAI. All rights reserved.
`;

  // Some email clients behave poorly with `overflow:hidden` and/or large amounts of whitespace in HTML.
  // Compacting helps reduce client-side clipping / "trimmed content" behaviors.
  const htmlOut = html
    .replace(/\r?\n/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
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


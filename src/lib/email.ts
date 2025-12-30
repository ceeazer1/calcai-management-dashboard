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
  const { to, customerName, orderId, amount, currency, items } = params;

  // Use Resend for email sending
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return;
  }

  const fromEmail = process.env.ORDER_FROM_EMAIL || 'orders@calcai.cc';
  const fromName = process.env.ORDER_FROM_NAME || 'CalcAI';

  // Email clients require absolute URLs for images.
  // Set ORDER_LOGO_URL to your uploaded logo (recommended). Fallbacks:
  // - EMAIL_ASSET_BASE_URL + /logo.png
  // - https://www.calcai.cc/logo.png
  const assetBase =
    (process.env.EMAIL_ASSET_BASE_URL || '').trim().replace(/\/+$/, '') ||
    'https://calcai-management-dashboard.vercel.app';
  const logoUrl =
    (process.env.ORDER_LOGO_URL || '').trim() ||
    `${assetBase}/logo.png` ||
    'https://www.calcai.cc/logo.png';

  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #262626; color: #e5e5e5;">${Number(item.quantity) || 1}× ${escapeHtml(item.description || 'Item')}</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #262626; text-align: right; color: #a3a3a3;">${formatCurrency(Number(item.amount) || 0, currency)}</td>
        </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#0a0a0a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">
          <tr>
            <td style="background-color:#171717; border:1px solid #262626; border-radius:20px; overflow:hidden;">

              <!-- Header (logo + title) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 28px 14px;">
                    <img src="${escapeHtml(logoUrl)}" width="120" alt="CalcAI" style="display:block; width:120px; max-width:120px; height:auto; border:0; outline:none; text-decoration:none;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 28px 20px; border-bottom:1px solid #262626;">
                    <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:600; letter-spacing:0.2px;">Order Confirmed</h1>
                  </td>
                </tr>
              </table>

              <!-- Horizontal progress (static, icons not numbers) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f; border-bottom:1px solid #262626;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
                      <tr>
                        <!-- Step 1 -->
                        <td align="center" valign="top" style="width:22%;">
                          <div style="width:34px; height:34px; background-color:#22c55e; border-radius:999px; display:inline-block; text-align:center;">
                            <span style="color:#ffffff; font-size:16px; line-height:34px; font-weight:700;">✓</span>
                          </div>
                          <div style="margin-top:8px; color:#22c55e; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.35px;">Order Placed</div>
                        </td>
                        <!-- Connector -->
                        <td style="width:4%; padding-top:17px;">
                          <div style="height:3px; background:linear-gradient(90deg,#22c55e 0%,#404040 100%); border-radius:999px;">&nbsp;</div>
                        </td>
                        <!-- Step 2 -->
                        <td align="center" valign="top" style="width:22%;">
                          <div style="width:34px; height:34px; background-color:#262626; border:2px solid #404040; border-radius:999px; display:inline-block; text-align:center;">
                            <span style="color:#a3a3a3; font-size:16px; line-height:30px; font-weight:600;">⟳</span>
                          </div>
                          <div style="margin-top:8px; color:#737373; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.35px;">Processing</div>
                        </td>
                        <!-- Connector -->
                        <td style="width:4%; padding-top:17px;">
                          <div style="height:3px; background-color:#404040; border-radius:999px;">&nbsp;</div>
                        </td>
                        <!-- Step 3 -->
                        <td align="center" valign="top" style="width:22%;">
                          <div style="width:34px; height:34px; background-color:#262626; border:2px solid #404040; border-radius:999px; display:inline-block; text-align:center;">
                            <span style="color:#a3a3a3; font-size:16px; line-height:30px; font-weight:600;">➜</span>
                          </div>
                          <div style="margin-top:8px; color:#737373; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.35px;">Shipped</div>
                        </td>
                        <!-- Connector -->
                        <td style="width:4%; padding-top:17px;">
                          <div style="height:3px; background-color:#404040; border-radius:999px;">&nbsp;</div>
                        </td>
                        <!-- Step 4 -->
                        <td align="center" valign="top" style="width:22%;">
                          <div style="width:34px; height:34px; background-color:#262626; border:2px solid #404040; border-radius:999px; display:inline-block; text-align:center;">
                            <span style="color:#a3a3a3; font-size:16px; line-height:30px; font-weight:600;">⌂</span>
                          </div>
                          <div style="margin-top:8px; color:#737373; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.35px;">Delivered</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Content -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:26px 28px 10px;">
                    <p style="margin:0 0 14px; color:#e5e5e5; font-size:16px; line-height:1.6;">Hi ${escapeHtml(customerName)},</p>
                    <p style="margin:0 0 18px; color:#a3a3a3; font-size:14px; line-height:1.7;">Thank you for your order. We’re getting it ready now.</p>

                    <!-- Order ID -->
                    <div style="background-color:#0f0f0f; border:1px solid #262626; border-radius:14px; padding:14px; margin:0 0 18px;">
                      <div style="color:#737373; font-size:11px; text-transform:uppercase; letter-spacing:0.45px;">Order ID</div>
                      <div style="margin-top:6px; color:#e5e5e5; font-size:13px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(orderId)}</div>
                    </div>

                    <!-- Items -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:14px;">
                      <thead>
                        <tr style="border-bottom:1px solid #262626;">
                          <th align="left" style="padding:10px 0; color:#737373; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.45px;">Item</th>
                          <th align="right" style="padding:10px 0; color:#737373; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.45px;">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsHtml}
                      </tbody>
                      <tfoot>
                        <tr style="border-top:1px solid #262626;">
                          <td style="padding:14px 0; font-weight:700; color:#ffffff;">Total</td>
                          <td align="right" style="padding:14px 0; font-weight:700; color:#ffffff; font-size:18px;">${formatCurrency(amount, currency)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    <!-- What's next -->
                    <div style="border-top:1px solid #262626; padding-top:16px; color:#a3a3a3; font-size:13px; line-height:1.8;">
                      <div style="margin:0 0 10px; color:#ffffff; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.45px;">What’s Next</div>
                      <div style="margin:0 0 8px; padding-left:14px; border-left:2px solid #3b82f6;">We’ll process your order within 1–2 business days</div>
                      <div style="margin:0 0 8px; padding-left:14px; border-left:2px solid #262626;">You’ll receive a shipping confirmation with tracking</div>
                      <div style="margin:0; padding-left:14px; border-left:2px solid #262626;">Estimated delivery: 3–7 business days after shipping</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Footer: social icons -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f; border-top:1px solid #262626;">
                <tr>
                  <td align="center" style="padding:18px 18px 10px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:0 8px;">
                          <a href="https://discord.gg/calcai" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                            <span style="display:inline-block; width:36px; height:36px; border-radius:999px; background-color:#171717; border:1px solid #262626; text-align:center;">
                              <span style="color:#e5e5e5; font-size:12px; line-height:36px; font-weight:700;">D</span>
                            </span>
                          </a>
                        </td>
                        <td style="padding:0 8px;">
                          <a href="https://www.tiktok.com/@calc_ai" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                            <span style="display:inline-block; width:36px; height:36px; border-radius:999px; background-color:#171717; border:1px solid #262626; text-align:center;">
                              <span style="color:#e5e5e5; font-size:12px; line-height:36px; font-weight:700;">TT</span>
                            </span>
                          </a>
                        </td>
                        <td style="padding:0 8px;">
                          <a href="https://instagram.com/calc.ai" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                            <span style="display:inline-block; width:36px; height:36px; border-radius:999px; background-color:#171717; border:1px solid #262626; text-align:center;">
                              <span style="color:#e5e5e5; font-size:12px; line-height:36px; font-weight:700;">IG</span>
                            </span>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 18px 18px;">
                    <div style="color:#525252; font-size:12px;">${new Date().getFullYear()} CalcAI. All rights reserved.</div>
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

Thank you for your order. We're excited to get your CalcAI on its way to you.

ORDER STATUS:
[✓] Order Placed  ->  [ ] Processing  ->  [ ] Shipped  ->  [ ] Delivered

Order ID: ${orderId}

Items:
${items.map((item) => `- ${item.quantity}x ${item.description}: ${formatCurrency(item.amount, currency)}`).join('\n')}

Total: ${formatCurrency(amount, currency)}

What's Next:
1. We'll process your order within 1-2 business days
2. You'll receive a shipping confirmation with tracking
3. Estimated delivery: 3-7 business days after shipping

Discord: https://discord.gg/calcai
TikTok: https://www.tiktok.com/@calc_ai
Instagram: https://instagram.com/calc.ai

${new Date().getFullYear()} CalcAI. All rights reserved.
`;

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
      html,
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


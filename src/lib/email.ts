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

  const itemsHtml = items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #262626; color: #e5e5e5;">${item.quantity}× ${item.description}</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #262626; text-align: right; color: #a3a3a3;">${formatCurrency(item.amount, currency)}</td>
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
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #171717; border-radius: 12px; border: 1px solid #262626; overflow: hidden;">
      <!-- Header -->
      <div style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #262626;">
        <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 600;">Order Confirmed</h1>
        <p style="margin: 0; color: #a3a3a3; font-size: 14px;">Thank you for your purchase</p>
      </div>
      
      <!-- Order Progress Timeline -->
      <div style="padding: 32px; background-color: #0f0f0f; border-bottom: 1px solid #262626;">
        <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
          <tr>
            <!-- Step 1: Order Placed (Completed) -->
            <td width="25%" style="text-align: center; vertical-align: top;">
              <div style="width: 32px; height: 32px; margin: 0 auto; background-color: #22c55e; border-radius: 50%; display: inline-block;">
                <span style="color: #ffffff; font-size: 14px; line-height: 32px;">&#10003;</span>
              </div>
            </td>
            <!-- Step 2: Processing (Pending) -->
            <td width="25%" style="text-align: center; vertical-align: top;">
              <div style="width: 32px; height: 32px; margin: 0 auto; background-color: #262626; border-radius: 50%; border: 2px solid #404040; display: inline-block;">
                <span style="color: #525252; font-size: 12px; line-height: 28px;">2</span>
              </div>
            </td>
            <!-- Step 3: Shipped (Pending) -->
            <td width="25%" style="text-align: center; vertical-align: top;">
              <div style="width: 32px; height: 32px; margin: 0 auto; background-color: #262626; border-radius: 50%; border: 2px solid #404040; display: inline-block;">
                <span style="color: #525252; font-size: 12px; line-height: 28px;">3</span>
              </div>
            </td>
            <!-- Step 4: Delivered (Pending) -->
            <td width="25%" style="text-align: center; vertical-align: top;">
              <div style="width: 32px; height: 32px; margin: 0 auto; background-color: #262626; border-radius: 50%; border: 2px solid #404040; display: inline-block;">
                <span style="color: #525252; font-size: 12px; line-height: 28px;">4</span>
              </div>
            </td>
          </tr>
          <!-- Connecting Lines -->
          <tr>
            <td colspan="4" style="padding: 8px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="12.5%"></td>
                  <td width="25%" style="height: 3px; background: linear-gradient(90deg, #22c55e 0%, #404040 100%);"></td>
                  <td width="25%" style="height: 3px; background-color: #404040;"></td>
                  <td width="25%" style="height: 3px; background-color: #404040;"></td>
                  <td width="12.5%"></td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Labels -->
          <tr>
            <td width="25%" style="text-align: center; padding-top: 8px;">
              <p style="margin: 0; color: #22c55e; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Order Placed</p>
            </td>
            <td width="25%" style="text-align: center; padding-top: 8px;">
              <p style="margin: 0; color: #525252; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px;">Processing</p>
            </td>
            <td width="25%" style="text-align: center; padding-top: 8px;">
              <p style="margin: 0; color: #525252; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px;">Shipped</p>
            </td>
            <td width="25%" style="text-align: center; padding-top: 8px;">
              <p style="margin: 0; color: #525252; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px;">Delivered</p>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px;">
        <p style="margin: 0 0 20px; color: #e5e5e5; font-size: 16px; line-height: 1.6;">
          Hi ${customerName},
        </p>
        <p style="margin: 0 0 24px; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
          Thank you for your order. We're excited to get your CalcAI on its way to you.
        </p>
        
        <!-- Order ID -->
        <div style="background-color: #0f0f0f; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Order ID</p>
          <p style="margin: 6px 0 0; color: #e5e5e5; font-size: 14px; font-family: monospace;">${orderId}</p>
        </div>
        
        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="border-bottom: 1px solid #262626;">
              <th style="padding: 12px 0; text-align: left; color: #737373; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
              <th style="padding: 12px 0; text-align: right; color: #737373; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="border-top: 1px solid #262626;">
              <td style="padding: 16px 0; font-weight: 600; color: #ffffff;">Total</td>
              <td style="padding: 16px 0; text-align: right; font-weight: 600; color: #ffffff; font-size: 18px;">${formatCurrency(amount, currency)}</td>
            </tr>
          </tfoot>
        </table>
        
        <!-- What's Next -->
        <div style="border-top: 1px solid #262626; padding-top: 24px;">
          <h3 style="margin: 0 0 16px; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">What's Next</h3>
          <div style="color: #a3a3a3; font-size: 14px; line-height: 1.8;">
            <p style="margin: 0 0 8px; padding-left: 16px; border-left: 2px solid #3b82f6;">We'll process your order within 1-2 business days</p>
            <p style="margin: 0 0 8px; padding-left: 16px; border-left: 2px solid #262626;">You'll receive a shipping confirmation with tracking</p>
            <p style="margin: 0; padding-left: 16px; border-left: 2px solid #262626;">Estimated delivery: 3-7 business days after shipping</p>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #0f0f0f; padding: 24px; text-align: center; border-top: 1px solid #262626;">
        <p style="margin: 0 0 8px; color: #737373; font-size: 14px;">
          Questions? Reply to this email or visit <a href="https://calcai.cc/faq" style="color: #3b82f6; text-decoration: none;">calcai.cc/faq</a>
        </p>
        <p style="margin: 0; color: #525252; font-size: 12px;">
          ${new Date().getFullYear()} CalcAI. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
Order Confirmed

Hi ${customerName},

Thank you for your order. We're excited to get your CalcAI on its way to you.

ORDER STATUS:
[✓] Order Placed  →  [ ] Processing  →  [ ] Shipped  →  [ ] Delivered

Order ID: ${orderId}

Items:
${items.map((item) => `- ${item.quantity}x ${item.description}: ${formatCurrency(item.amount, currency)}`).join('\n')}

Total: ${formatCurrency(amount, currency)}

What's Next:
1. We'll process your order within 1-2 business days
2. You'll receive a shipping confirmation with tracking
3. Estimated delivery: 3-7 business days after shipping

Questions? Reply to this email or visit https://calcai.cc/faq

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


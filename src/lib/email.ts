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
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">${item.quantity}× ${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatCurrency(item.amount, currency)}</td>
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
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Order Confirmed! 🎉</h1>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px;">
        <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
          Hi ${customerName},
        </p>
        <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
          Thank you for your order! We're excited to get your CalcAI on its way to you.
        </p>
        
        <!-- Order ID -->
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">Order ID</p>
          <p style="margin: 4px 0 0; color: #111827; font-size: 14px; font-family: monospace;">${orderId}</p>
        </div>
        
        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 14px; font-weight: 500;">Item</th>
              <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 14px; font-weight: 500;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding: 16px 12px; font-weight: 600; color: #111827;">Total</td>
              <td style="padding: 16px 12px; text-align: right; font-weight: 600; color: #111827; font-size: 18px;">${formatCurrency(amount, currency)}</td>
            </tr>
          </tfoot>
        </table>
        
        <!-- What's Next -->
        <div style="border-top: 1px solid #e5e5e5; padding-top: 24px;">
          <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px; font-weight: 600;">What's Next?</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
            <li>We'll process your order within 1-2 business days</li>
            <li>You'll receive a shipping confirmation email with tracking info</li>
            <li>Estimated delivery: 3-7 business days after shipping</li>
          </ul>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e5e5;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
          Questions? Reply to this email or visit <a href="https://calcai.cc/faq" style="color: #3b82f6; text-decoration: none;">calcai.cc/faq</a>
        </p>
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          © ${new Date().getFullYear()} CalcAI. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
Order Confirmed!

Hi ${customerName},

Thank you for your order! We're excited to get your CalcAI on its way to you.

Order ID: ${orderId}

Items:
${items.map((item) => `- ${item.quantity}× ${item.description}: ${formatCurrency(item.amount, currency)}`).join('\n')}

Total: ${formatCurrency(amount, currency)}

What's Next?
- We'll process your order within 1-2 business days
- You'll receive a shipping confirmation email with tracking info
- Estimated delivery: 3-7 business days after shipping

Questions? Reply to this email or visit https://calcai.cc/faq

© ${new Date().getFullYear()} CalcAI. All rights reserved.
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


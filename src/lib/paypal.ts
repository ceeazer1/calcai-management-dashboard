export async function getPayPalAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("PayPal credentials missing in environment variables");
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    // Use sandbox or production based on what's configured
    const url = clientId.startsWith('AR')
        ? "https://api-m.paypal.com/v1/oauth2/token"
        : "https://api-m.sandbox.paypal.com/v1/oauth2/token";

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get PayPal access token: ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
}

export async function addPayPalTracking(paypalOrderId: string, trackingNumber: string, carrier: string) {
    const accessToken = await getPayPalAccessToken();

    const isSandbox = !process.env.PAYPAL_CLIENT_ID?.startsWith('AR');
    const url = isSandbox
        ? `https://api-m.sandbox.paypal.com/v2/checkout/orders/${paypalOrderId}/track`
        : `https://api-m.paypal.com/v2/checkout/orders/${paypalOrderId}/track`;

    // Map carrier names to PayPal supported carriers if needed
    // For USPS, "USPS" is usually fine.

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            tracking_number: trackingNumber,
            carrier: carrier.toUpperCase(),
            notify_payer: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`PayPal Tracking Error (${response.status}):`, errorText);
        return { ok: false, error: errorText };
    }

    return { ok: true };
}

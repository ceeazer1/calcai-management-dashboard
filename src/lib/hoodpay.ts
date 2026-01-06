import { HoodPayClient } from "@internal-labs/hoodpay";

let client: HoodPayClient | null = null;

export function getHoodpayClient(): HoodPayClient | null {
  if (client) return client;
  
  const apiKey = process.env.HOODPAY_API_KEY;
  const businessId = process.env.HOODPAY_BUSINESS_ID;
  
  if (!apiKey || !businessId) {
    return null;
  }
  
  client = new HoodPayClient({
    apiKey,
    businessId,
  });
  
  return client;
}

export function isHoodpayConfigured(): boolean {
  return !!(process.env.HOODPAY_API_KEY && process.env.HOODPAY_BUSINESS_ID);
}


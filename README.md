This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## eBay Listings section (Dashboard)

This dashboard includes an `/ebay` section that uses eBay's **Browse API** for:

- Searching listings (`item_summary/search`)
- Fetching full item details (`getItem`) including images + description
- Watchlist + price snapshots (stored in **Vercel KV** when configured)
- Buying actions (Best Offer / Bid / Checkout) via eBay APIs (requires user OAuth)

### Required env vars

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

### Optional env vars

- `EBAY_ENV`: `production` (default) or `sandbox`
- `EBAY_API_BASE_URL`: override base URL (advanced)
- `EBAY_OAUTH_SCOPE`: override OAuth scope (default is Browse-ready app scope)
- `EBAY_OAUTH_RU_NAME` (or `EBAY_RU_NAME`): eBay OAuth “redirect URI name” (RuName) for user login (required for Best Offer / Bid / Checkout)
- `EBAY_USER_OAUTH_SCOPES`: OAuth scopes for user login (defaults to `api_scope`, `buy.offer.auction`, `buy.order`)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: enables persistence via Vercel KV (otherwise uses an in-memory dev fallback)
- `EBAY_CRON_TOKEN`: if set, enables the protected cron endpoint `GET /api/ebay/cron-refresh?token=...` to refresh watched items for all known users
- `EBAY_ORDER_API_ENABLED`: set to `1` to enable the **Order API** checkout endpoints in the dashboard (gated / limited release)
- `EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN`: required only if you configure eBay “Marketplace account deletion notification endpoint” verification (see below)

## Email (Resend)

Order confirmation and shipped emails are sent via Resend.

### Required env vars

- `RESEND_API_KEY` - Your Resend API key

### Optional env vars

- `ORDER_FROM_NAME` - Sender name (default: "CalcAI")
- `ORDER_FROM_EMAIL` - Sender email (default: "orders@calcai.cc")

## Hoodpay (Payments)

The Orders page fetches payments from Hoodpay and supports order confirmation emails.

### Required env vars

- `HOODPAY_API_KEY` - Your Hoodpay API key (from Settings > Developer)
- `HOODPAY_BUSINESS_ID` - Your Hoodpay Business ID

### Webhook setup

Configure your Hoodpay webhook to point to:
- `https://<your-dashboard-domain>/api/orders/webhook`

This will automatically send confirmation emails when payments complete.

## Square (Order Import)

The Orders page includes an **Import from Square** button to fetch orders from Square POS.

### Required env vars

- `SQUARE_ACCESS_TOKEN` - Your Square access token (from [Square Developer Dashboard](https://developer.squareup.com/))

### Optional env vars

- `SQUARE_ENVIRONMENT` - `production` (default) or `sandbox`
- `SQUARE_LOCATION_IDS` - Comma-separated list of location IDs to filter orders (optional, fetches from all locations if not set)

### Usage

1. Click **Import from Square** in the Orders page
2. Orders are imported and cached for 5 minutes
3. Square orders appear with a purple "Square" badge
4. Use the "Square" filter to view only Square orders

### Storing shipping addresses

Since Hoodpay doesn't store shipping addresses, your website checkout should call:
```
POST /api/orders/address
{
  "paymentId": "hoodpay-payment-id",
  "address": {
    "name": "John Doe",
    "email": "john@example.com",
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US",
    "shippingMethod": "USPS Priority",
    "shippingAmount": 5.99
  }
}
```

## Shipping labels (Shippo)

The Orders page supports a **Create USPS label** button powered by Shippo. When a label is created, the order is marked **Shipped** (label created) and the label + tracking are saved in **Vercel KV**.

### Required env vars

- `SHIPPO_API_TOKEN`
- `SHIPPO_API_TOKEN`

The return address is hardcoded in the ship-label route (CalcAI address).

Parcel defaults (used to rate-shop and buy the cheapest USPS label):

- `SHIP_PARCEL_LENGTH_IN` (default 8)
- `SHIP_PARCEL_WIDTH_IN` (default 6)
- `SHIP_PARCEL_HEIGHT_IN` (default 4)
- `SHIP_PARCEL_WEIGHT_OZ` (default 16)

### Notes

- Best Offer + Bid use a **user OAuth** token (stored server-side in KV when configured). If KV is not configured, tokens will be ephemeral in dev.
- Checkout uses the **Buy Order API** endpoints and is gated behind `EBAY_ORDER_API_ENABLED` (and eBay API access).

### Buying actions setup (Best Offer / Bid / Checkout)

1. In the eBay Developer Portal, configure your app’s OAuth redirect and note the **RuName**.
2. Set your redirect URL to:
   - `https://<your-dashboard-domain>/api/ebay/oauth/callback`
3. In Vercel env vars, set:
   - `EBAY_OAUTH_RU_NAME=<your RuName>`
   - (optional) `EBAY_USER_OAUTH_SCOPES=...`
4. Open `/ebay` and click **Connect eBay** in an item’s “Buying actions” panel.

### Marketplace account deletion notifications (eBay compliance)

In the eBay Developer Portal, under your app’s **Notifications**, you may be asked to configure:

- **Marketplace account deletion notification endpoint**: use your public HTTPS URL:
  - `https://<your-dashboard-domain>/api/ebay/account-deletion`
- **Verification token**: generate a random 32–80 char string and set it in:
  - eBay portal field **and**
  - `EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN` (Vercel env var)

This repo includes the matching route handler at `src/app/api/ebay/account-deletion/route.ts` that answers eBay’s verification `challenge_code` requests.

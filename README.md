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
- Watchlist + saved searches + price snapshots (stored in **Vercel KV** when configured)

### Required env vars

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

### Optional env vars

- `EBAY_ENV`: `production` (default) or `sandbox`
- `EBAY_API_BASE_URL`: override base URL (advanced)
- `EBAY_OAUTH_SCOPE`: override OAuth scope (default is Browse-ready app scope)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: enables persistence via Vercel KV (otherwise uses an in-memory dev fallback)
- `EBAY_CRON_TOKEN`: if set, enables the protected cron endpoint `GET /api/ebay/cron-refresh?token=...` to refresh watched items for all known users

### Notes

- Buying actions (Best Offer / Bidding / Checkout) are intentionally stubbed and should be implemented behind feature flags once the required eBay API access + user OAuth flows are available.

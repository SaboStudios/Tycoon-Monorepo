This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment variables

These `NEXT_PUBLIC_` variables are read by `middleware.ts` (the CSP `connect-src`
allowlist) and by the API/shop clients under `src/lib` and `src/hooks`. No secret
value belongs here — everything below is inlined into the client bundle.

| Variable | Example | What breaks when it is absent |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `https://api.tycoon.example.com` | Read by `middleware.ts` to build the CSP `connect-src` for the main backend. In production, a missing value fails the build (`CspConfigError`, thrown from `apiHosts()`); outside production it falls back to `http://localhost:3001`, so API calls to the real backend are blocked by the CSP. |
| `NEXT_PUBLIC_SHOP_API_URL` | `https://shop-api.tycoon.example.com` | Read by `middleware.ts` the same way, for the shop-api (purchases) origin. Missing in production fails the build for the same reason; outside production it falls back to `http://localhost:3002`. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Read by `src/lib/api.ts` and `src/lib/api/client.ts` as the base URL for non-shop API requests from the browser. Falls back to a `localhost` default when unset, so requests silently target the wrong host once deployed. |

## Analytics

The frontend includes a small analytics taxonomy layer for staging validation.

- Set `NEXT_PUBLIC_ANALYTICS_PROVIDERS=plausible`, `ga4`, `posthog`, or a comma-separated combination to fan out events to supported providers.
- Set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` in development to expose `window.__tycoonAnalytics.events` and log sanitized events to the console.
- Visit `/shop` to emit `view_shop`, then use the "Track Purchase" buttons to emit `purchase_click` without sending PII-bearing fields.

## Testing

Run the frontend unit test suite from the `frontend/` directory:

```bash
cd frontend
npm test
```

This runs the `test` script defined in `frontend/package.json`.

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

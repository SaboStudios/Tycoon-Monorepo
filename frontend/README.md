This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Analytics

The frontend includes a small analytics taxonomy layer for staging validation.

- Set `NEXT_PUBLIC_ANALYTICS_PROVIDERS=plausible`, `ga4`, `posthog`, or a comma-separated combination to fan out events to supported providers.
- Set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` in development to expose `window.__tycoonAnalytics.events` and log sanitized events to the console.
- Visit `/shop` to emit `view_shop`, then use the "Track Purchase" buttons to emit `purchase_click` without sending PII-bearing fields.

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

## Join Room Flow

- `/join-room` accepts a strict 6-character alphanumeric room code and preserves the last valid join code in browser session storage.
- `/game-waiting` validates the incoming `gameCode` query string and gracefully shows retry navigation when the code is missing or invalid.
- `/offline` renders the PWA offline shell with live browser connectivity detection, persists the last known connection status, and avoids caching live game state to prevent stale session conflicts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Notes — layout.tsx strictness

- `app/layout.tsx` was hardened to be TypeScript-strict friendly: the root layout now accepts `children?: React.ReactNode | null` and guards against null/undefined children.
- Exported `isDev` boolean to make debug-mode branch testable.
- Unit tests were added at `src/app/__tests__/layout.test.tsx` to verify null/undefined children render safely.

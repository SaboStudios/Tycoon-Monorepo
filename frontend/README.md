This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## PWA Notes

- The app registers `/sw.js` with explicit scope `/` and versioned shell cache `tycoon-shell-v1`.
- Only app-shell assets are cached persistently: `/_next/static/*`, manifest, app icons, and the offline fallback route.
- Dynamic game state, route HTML, wallet traffic, and API data are intentionally excluded from persistent caching to avoid stale session conflicts.
- When a new service worker is waiting, the in-app update banner prompts the user to refresh into the new shell.
- Install prompt support is wired through `beforeinstallprompt`, which is the Android Chrome path required by Issue #344.
- Target Lighthouse PWA score: `>= 90` on the production build after manifest, service worker, and installability checks are active.
- Manual acceptance path: verify install prompt on Android Chrome, confirm update banner on new service worker, and confirm offline navigations fall back to `/offline`.

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

const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
   "accountAssociation": {
    "header": "eyJmaWQiOjExMTc2NDIsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhjNTVGMGU4MzE5M0M5QkRiMmQ5QjE1QTRiQUQyZkVFNjJiNUY2NGQ5In0",
    "payload": "eyJkb21haW4iOiJ0eWNvb253b3JsZC54eXoifQ",
    "signature": "xDWXI7kLJTTi5W8+gxrolkN5OMxNVMLON22SZUd8xTVgAcBizVpGh3mzVETaZ+fHwNlFdYSbMqaN4c2it2n/vxw="
  },
  miniapp: {
    version: "1",
    name: "Tycoon", 
    subtitle: "monopoly mini app", 
    description: "Ads",
    screenshotUrls: [`${ROOT_URL}/image.png`],
    iconUrl: `${ROOT_URL}/logo.png`,
    splashImageUrl: `${ROOT_URL}/logo.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["marketing", "ads", "quickstart", "waitlist"],
    heroImageUrl: `${ROOT_URL}/logo.png`, 
    tagline: "",
    ogTitle: "",
    ogDescription: "",
    ogImageUrl: `${ROOT_URL}/logo.png`,
  },
} as const;


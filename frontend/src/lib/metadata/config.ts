/**
 * Metadata Configuration
 *
 * Centralized configuration for SEO metadata across the application.
 * Supports environment-based staging noindex via NEXT_PUBLIC_APP_ENV.
 */

export const siteConfig = {
  name: "Tycoon",
  description:
    "Experience the ultimate tycoon gaming platform with immersive gameplay, AI-powered opponents, and real-time multiplayer action.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ogImage: "/metadata/og-image.png",
  keywords: ["tycoon", "gaming", "multiplayer", "strategy", "board game", "AI"],
  creator: "Tycoon Team",
  twitter: {
    handle: "@tycoongame",
    site: "@tycoongame",
    cardType: "summary_large_image" as const,
  },
  themeColor: "#010F10",
};

export type PageMetadataConfig = {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  keywords?: string[];
  noindex?: boolean;
};

/**
 * Check if the app is running in staging environment
 * Staging environments should have noindex enabled
 */
export const isStaging = (): boolean => {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  return (
    appEnv === "staging" || appEnv === "preview" || appEnv === "development"
  );
};

/**
 * Generate canonical URL from path
 */
export const getCanonicalUrl = (path?: string): string => {
  const baseUrl = siteConfig.url;
  if (!path) return baseUrl;

  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

/**
 * Default metadata configuration for pages
 */
export const defaultPageMetadata: PageMetadataConfig = {
  title: siteConfig.name,
  description: siteConfig.description,
  noindex: isStaging(),
};

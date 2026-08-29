import type { MetadataRoute } from "next";
import { siteConfig, isStaging } from "@/lib/metadata";

/**
 * Sitemap configuration
 *
 * Defines all public pages that should be indexed by search engines.
 * In staging/development, returns empty sitemap to prevent indexing.
 *
 * Note: /trade-demo is intentionally excluded because it requires
 * authentication (middleware redirect) and is feature-flag gated
 * via isTradeDemoEnabled(). It should not be indexed by search engines.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;
  const staging = isStaging();

  // Do not expose sitemap in staging/development
  if (staging) {
    return [];
  }

  const routes = [
    // Core pages
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/play-ai`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    // /trade-demo removed — auth-gated and feature-flag gated (isTradeDemoEnabled)
    {
      url: `${baseUrl}/join-room`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/game-settings`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    },
  ];

  return routes;
}

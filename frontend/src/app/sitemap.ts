import type { MetadataRoute } from "next";
import { siteConfig, isStaging } from "@/lib/metadata";

/**
 * Sitemap configuration
 *
 * Defines all public pages that should be indexed by search engines.
 * In staging/development, returns empty sitemap to prevent indexing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;
  const staging = isStaging();

  // Don't expose sitemap in staging/development
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
    {
      url: `${baseUrl}/trade-demo`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
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

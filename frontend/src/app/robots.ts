import type { MetadataRoute } from 'next';
import { siteConfig, isStaging } from '@/lib/metadata';

/**
 * Robots configuration
 *
 * Dynamically generates robots.txt based on environment:
 * - Production: Allows all search engines
 * - Staging/Development: Blocks all search engines
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteConfig.url;
  const staging = isStaging();

  if (staging) {
    // Block all crawlers in staging
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }

  // Allow all crawlers in production
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        crawlDelay: 1,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
      },
      {
        userAgent: 'Twitterbot',
        allow: '/',
      },
      {
        userAgent: 'facebookexternalhit',
        allow: '/',
      },
      {
        userAgent: 'LinkedInBot',
        allow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

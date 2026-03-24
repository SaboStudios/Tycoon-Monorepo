import { NextResponse } from 'next/server';
import { siteConfig, isStaging } from '@/lib/metadata';

/**
 * GET handler for robots.txt
 * 
 * Dynamically generates robots.txt based on environment:
 * - Production: Allows all search engines
 * - Staging/Development: Blocks all search engines
 */
export async function GET() {
  const baseUrl = siteConfig.url;
  const staging = isStaging();

  const robotsContent = staging
    ? `# Staging/Development Environment
# Do not index this site

User-agent: *
Disallow: /

# Block all crawlers in staging
Sitemap: ${baseUrl}/sitemap.xml
`
    : `# Production Environment
# Allow all search engines to index

User-agent: *
Allow: /

# Crawl-delay for polite crawling
Crawl-delay: 1

# Google specific settings
User-agent: Googlebot
Allow: /
max-snippet: -1
max-image-preview: large
max-video-preview: -1

# Bing specific settings
User-agent: Bingbot
Allow: /

# Twitter
User-agent: Twitterbot
Allow: /

# Facebook
User-agent: facebookexternalhit
Allow: /

# LinkedIn
User-agent: LinkedInBot
Allow: /

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
`;

  return new NextResponse(robotsContent, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

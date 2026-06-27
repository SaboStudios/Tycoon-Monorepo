# Metadata utilities

This module contains shared metadata utilities used by the Tycoon frontend.

## Public API

- `siteConfig` — global SEO configuration for the application.
- `isStaging()` — returns whether the app should use staging-specific metadata defaults.
- `getCanonicalUrl(path?)` — returns a normalized canonical URL for a page.
- `defaultPageMetadata` — fallback page metadata defaults.
- `generateBaseMetadata(overrides?)` — base metadata for the app layout.
- `generatePageMetadata(options)` — page-specific metadata with defaults and canonical linking.

## Notes

- `generateBaseMetadata` always includes a default Open Graph image and default keywords.
- `generatePageMetadata` now supplies default site metadata when `keywords` or `ogImage` are omitted.
- `getCanonicalUrl` trims whitespace and normalizes the path to ensure generated canonical URLs are stable.

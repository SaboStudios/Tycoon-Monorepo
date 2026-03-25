/**
 * Metadata Utilities
 * 
 * Central export for all metadata-related utilities
 */

export { siteConfig, isStaging, getCanonicalUrl, defaultPageMetadata } from './config';
export type { PageMetadataConfig } from './config';
export { generateBaseMetadata, generatePageMetadata } from './helpers';

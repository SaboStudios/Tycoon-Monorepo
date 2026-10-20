import { basename } from 'path';

/**
 * Reduces client-supplied filenames to a safe label for logs and metrics (no path segments, no secrets).
 */
export function sanitizeUploadFilename(original: string | undefined | null): string {
  if (!original || typeof original !== 'string') {
    return 'unnamed';
  }
  const base = basename(original.replace(/\\/g, '/')).replace(/\.\./g, '_');
  const cleaned = base.replace(/[^\w.\-]+/g, '_').slice(0, 64);
  return cleaned.length > 0 ? cleaned : 'unnamed';
}

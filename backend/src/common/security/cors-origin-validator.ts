export interface CorsOriginCheckOptions {
  allowedOrigins: string[];
  isDevelopment: boolean;
  devWildcard: boolean;
}

/**
 * Pure allow/deny check used by the CORS origin callback in main.ts.
 * Requests with no Origin header (mobile apps, curl, server-to-server) are allowed.
 * In development, localhost/127.0.0.1/*.local are allowed when devWildcard is enabled.
 */
export function isOriginAllowed(
  origin: string | undefined,
  { allowedOrigins, isDevelopment, devWildcard }: CorsOriginCheckOptions,
): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (isDevelopment && devWildcard) {
    try {
      const hostname = new URL(origin).hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local')
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

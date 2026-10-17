import type { HelmetOptions } from 'helmet';

/**
 * Builds the helmet options used by the backend.
 *
 * `upgradeInsecureRequests` is only added in production so that local
 * development over plain http (e.g. Swagger UI) keeps working.
 *
 * `crossOriginEmbedderPolicy` is explicitly disabled because enabling it
 * breaks Swagger UI CDN assets.
 *
 * See backend/docs/security/REVERSE_PROXY_HEADERS.md for the reverse-proxy
 * duplication caveat.
 */
export function buildHelmetOptions(isProduction: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
  };
}

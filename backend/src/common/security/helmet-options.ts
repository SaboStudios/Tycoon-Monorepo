import type { ConfigService } from '@nestjs/config';
import type { HelmetOptions } from 'helmet';

/**
 * Builds the helmet options object used in main.ts.
 *
 * Extracted so the options can be unit-tested without booting the full
 * NestJS application (issue #1922).
 *
 * Behaviour:
 *  - CSP: defaultSrc 'self', objectSrc 'none', frameAncestors 'none'.
 *  - upgradeInsecureRequests is added to CSP only in production.
 *  - frameguard: deny, noSniff: true, xssFilter: false.
 *  - crossOriginEmbedderPolicy: false to keep Swagger UI working.
 */
export function buildHelmetOptions(configService: ConfigService): HelmetOptions {
  const isProduction =
    configService.get<string>('app.nodeEnv') === 'production';

  return {
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },

    noSniff: true,

    frameguard: { action: 'deny' },

    // Disable the legacy X-XSS-Protection header; modern browsers use CSP.
    xssFilter: false,

    hidePoweredBy: true,

    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    permittedCrossDomainPolicies: { permittedPolicies: 'none' },

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },

    // crossOriginEmbedderPolicy disabled: enabling it breaks Swagger UI CDN assets.
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  };
}

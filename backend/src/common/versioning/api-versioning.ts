import { INestApplication, RequestMethod, VersioningType } from '@nestjs/common';

type ApiVersioningOptions = {
  apiPrefix: string;
  defaultVersion: string;
  enableLegacyUnversionedRoutes: boolean;
  legacyUnversionedSunset?: string;
};

const API_VERSION_SEGMENT_REGEX = /^v\d+$/i;

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function sanitizeVersion(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.replace(/^v/, '') || '1';
}

function normalizeApiPrefix(
  rawApiPrefix: string,
  rawDefaultVersion: string,
): { apiPrefix: string; defaultVersion: string } {
  const normalizedPrefix = trimSlashes(rawApiPrefix || 'api');
  const versionedPrefixMatch = normalizedPrefix.match(/^(.*)\/v(\d+)$/i);

  if (!versionedPrefixMatch) {
    return {
      apiPrefix: normalizedPrefix || 'api',
      defaultVersion: sanitizeVersion(rawDefaultVersion),
    };
  }

  const basePrefix = trimSlashes(versionedPrefixMatch[1]) || 'api';
  const prefixVersion = sanitizeVersion(versionedPrefixMatch[2]);
  const defaultVersion = rawDefaultVersion
    ? sanitizeVersion(rawDefaultVersion)
    : prefixVersion;

  return {
    apiPrefix: basePrefix,
    defaultVersion,
  };
}

export function configureApiVersioning(
  app: INestApplication,
  options: ApiVersioningOptions,
): { apiPrefix: string; defaultVersion: string } {
  const { apiPrefix, defaultVersion } = normalizeApiPrefix(
    options.apiPrefix,
    options.defaultVersion,
  );

  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'health/(.*)', method: RequestMethod.ALL },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion,
  });

  if (options.enableLegacyUnversionedRoutes) {
    app.use(`/${apiPrefix}`, (req, res, next) => {
      const firstSegment = req.path.split('/').filter(Boolean)[0] || '';
      if (API_VERSION_SEGMENT_REGEX.test(firstSegment)) {
        next();
        return;
      }

      res.setHeader('Deprecation', 'true');
      if (options.legacyUnversionedSunset) {
        res.setHeader('Sunset', options.legacyUnversionedSunset);
      }

      const normalizedPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
      req.url = `/v${defaultVersion}${normalizedPath}`;
      next();
    });
  }

  return {
    apiPrefix,
    defaultVersion,
  };
}
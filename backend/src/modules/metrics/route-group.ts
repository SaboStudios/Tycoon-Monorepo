/**
 * Low-cardinality route group for HTTP metrics (no user ids or raw paths).
 * - admin: paths containing an `/admin/` segment (e.g. /api/v1/admin/...).
 * - internal: scrape and health endpoints (excluded from admin vs public traffic).
 * - public: everything else.
 */
export type HttpRouteGroup = 'admin' | 'public' | 'internal';

export function classifyHttpRouteGroup(path: string): HttpRouteGroup {
  const normalized = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/';

  if (normalized === '/metrics' || normalized.startsWith('/metrics/')) {
    return 'internal';
  }
  if (
    normalized === '/health' ||
    normalized.startsWith('/health/') ||
    normalized.includes('/health/')
  ) {
    return 'internal';
  }

  if (/\/admin(\/|$)/.test(normalized)) {
    return 'admin';
  }

  return 'public';
}

export function httpStatusClass(statusCode: number): '2xx' | '3xx' | '4xx' | '5xx' {
  if (statusCode >= 500) return '5xx';
  if (statusCode >= 400) return '4xx';
  if (statusCode >= 300) return '3xx';
  return '2xx';
}

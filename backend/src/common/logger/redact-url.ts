/**
 * Query parameters whose values must never reach logs. The data-export
 * download link, for example, authenticates with `?token=<jwt>`
 * (docs/support/user-data-export-runbook.md).
 */
const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'signature',
  'sig',
  'key',
  'api_key',
  'apikey',
  'password',
  'secret',
]);

/** Replaces the values of sensitive query parameters with `[REDACTED]`. */
export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;

  const path = url.slice(0, queryStart);
  const query = url
    .slice(queryStart + 1)
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      const rawKey = eq === -1 ? pair : pair.slice(0, eq);
      let key = rawKey;
      try {
        key = decodeURIComponent(rawKey);
      } catch {
        // Malformed escapes: fall back to the raw key.
      }
      return SENSITIVE_QUERY_KEYS.has(key.toLowerCase())
        ? `${rawKey}=[REDACTED]`
        : pair;
    })
    .join('&');
  return `${path}?${query}`;
}

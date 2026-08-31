import { TycoonApiError, parseErrorResponse } from './errors';

const BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/v1';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  // Canonical key is 'accessToken' (camelCase), matching backend DTO.
  // Migration fallback: if not found, try legacy snake_case key for existing sessions.
  let token = localStorage.getItem('accessToken');
  if (!token) {
    token = localStorage.getItem('access_token');
    if (token) localStorage.setItem('accessToken', token);
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Single-flight refresh gate.
 *
 * When the first 401 arrives we kick off a token refresh; any concurrent
 * requests that also see 401 wait on the same promise instead of firing
 * parallel refresh calls (which would race and invalidate each other).
 */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data: { accessToken: string; refreshToken: string } =
        await res.json();

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Sync the middleware cookie so server-side checks stay current.
      document.cookie = `auth-token=${data.accessToken}; path=/; max-age=3600; SameSite=Lax`;

      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  document.cookie =
    'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  // Redirect to login — use assign so the navigation is visible in tests.
  if (typeof window !== 'undefined') {
    window.location.assign('/login');
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new TycoonApiError({
        code: 'TIMEOUT',
        statusCode: 408,
        message: `Request timed out after ${timeoutMs}ms`,
      });
    }
    throw new TycoonApiError({
      code: 'NETWORK_ERROR',
      statusCode: 0,
      message: (err as Error).message ?? 'Network error',
    });
  } finally {
    clearTimeout(id);
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  /** Skip attaching the Authorization header */
  public?: boolean;
  /** AbortSignal for request cancellation (e.g. form unmount / timeout racing) */
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = opts;
  const url = `${BASE_URL}${path}`;

  const buildInit = (): RequestInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.public ? {} : getAuthHeaders()),
    };
    return {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    };
  };

  let attempt = 0;
  while (true) {
    const res = await fetchWithTimeout(url, buildInit(), timeoutMs);

    if (res.ok) {
      // 204 No Content
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    }

    // --- 401 handling: refresh token and retry once ---
    if (res.status === 401 && !opts.public) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Retry the original request with the fresh token.
        const retryRes = await fetchWithTimeout(url, buildInit(), timeoutMs);
        if (retryRes.ok) {
          if (retryRes.status === 204) return undefined as T;
          return retryRes.json() as Promise<T>;
        }
      }

      // Refresh failed or retried request still unauthorized — log out.
      clearSession();
      throw await parseErrorResponse(res);
    }

    if (RETRYABLE_STATUSES.has(res.status) && attempt < retries) {
      attempt++;
      await new Promise((r) => setTimeout(r, 200 * attempt));
      continue;
    }

    throw await parseErrorResponse(res);
  }
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>('GET', path, undefined, opts),

  post: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, body, opts),

  patch: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', path, body, opts),

  put: <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>('PUT', path, body, opts),

  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>('DELETE', path, undefined, opts),
};

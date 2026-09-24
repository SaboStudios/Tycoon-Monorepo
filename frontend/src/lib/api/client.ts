import { TycoonApiError, parseErrorResponse } from './errors';

const BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000') + '/api/v1';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = MAX_RETRIES } = opts;
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.public ? {} : getAuthHeaders()),
  };

  const init: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let attempt = 0;
  while (true) {
    const res = await fetchWithTimeout(url, init, timeoutMs);

    if (res.ok) {
      // 204 No Content
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
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

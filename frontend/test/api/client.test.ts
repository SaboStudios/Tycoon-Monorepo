import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../../src/lib/api/client';
import { TycoonApiError } from '../../src/lib/api/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown = {}, statusText = '') {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      statusText,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchOnce(...responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  return fn;
}

function okResponse(body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Auth headers ─────────────────────────────────────────────────────────────

describe('auth headers', () => {
  it('attaches Authorization header when token exists in localStorage', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('my-token');
    const fetchMock = mockFetch(200, { id: 1 });
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/games');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token');
  });

  it('omits Authorization header when no token in localStorage', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/games');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('omits Authorization header when public option is true even if token exists', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('my-token');
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.post('/auth/login', { email: 'a@b.com', password: 'x' }, { public: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('always sets Content-Type: application/json', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/games');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});

// ─── HTTP methods ─────────────────────────────────────────────────────────────

describe('HTTP methods', () => {
  it('GET sends correct method and no body', async () => {
    const fetchMock = mockFetch(200, { data: [] });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.get<{ data: unknown[] }>('/games');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/games');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(result).toEqual({ data: [] });
  });

  it('POST serializes body as JSON', async () => {
    const fetchMock = mockFetch(201, { id: 1 });
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.post('/games', { mode: 'PUBLIC', numberOfPlayers: 4 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ mode: 'PUBLIC', numberOfPlayers: 4 }));
  });

  it('PATCH sends correct method', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.patch('/games/1', { status: 'RUNNING' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
  });

  it('PUT sends correct method', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.put('/games/1/settings', { ranked: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PUT');
  });

  it('DELETE sends correct method and no body', async () => {
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.delete('/games/1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });

  it('returns undefined for 204 No Content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await apiClient.delete('/games/1');
    expect(result).toBeUndefined();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('error handling', () => {
  it('throws TycoonApiError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { message: 'Unauthorized' }));

    await expect(apiClient.get('/games')).rejects.toBeInstanceOf(TycoonApiError);
    await expect(apiClient.get('/games')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('throws TycoonApiError on 403', async () => {
    vi.stubGlobal('fetch', mockFetch(403, { message: 'Forbidden' }));

    await expect(apiClient.get('/admin')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('throws TycoonApiError on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { message: 'Not found' }));

    await expect(apiClient.get('/games/999')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws TycoonApiError on 400 with validation details', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(400, { message: 'Validation failed', errors: { mode: ['must be PUBLIC or PRIVATE'] } }),
    );

    await expect(apiClient.post('/games', {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: { mode: ['must be PUBLIC or PRIVATE'] },
    });
  });

  it('throws NETWORK_ERROR when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));

    await expect(apiClient.get('/games')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      statusCode: 0,
    });
  });
});

// ─── Retry logic ──────────────────────────────────────────────────────────────

describe('retry logic', () => {
  it('retries on 503 and succeeds on the next attempt', async () => {
    const fetchMock = mockFetchOnce(errorResponse(503), okResponse({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const promise = apiClient.get('/games');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 1 });
    vi.useRealTimers();
  });

  it('retries on 429 up to MAX_RETRIES then throws', async () => {
    const fetchMock = mockFetchOnce(
      errorResponse(429),
      errorResponse(429),
      errorResponse(429),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const promise = apiClient.get('/games', { retries: 2 });
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toMatchObject({ statusCode: 429 });
    // 1 initial + 2 retries = 3 total calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('does NOT retry on 404 (non-retryable)', async () => {
    const fetchMock = mockFetchOnce(errorResponse(404), okResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/games/999')).rejects.toMatchObject({ statusCode: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry when retries option is 0', async () => {
    const fetchMock = mockFetchOnce(errorResponse(503), okResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/games', { retries: 0 })).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── Timeout ──────────────────────────────────────────────────────────────────

describe('timeout', () => {
  it('throws TIMEOUT error when request exceeds timeoutMs', async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('AbortError');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );

    const promise = apiClient.get('/games', { timeoutMs: 100, retries: 0 });
    vi.advanceTimersByTime(200);

    await expect(promise).rejects.toMatchObject({
      code: 'TIMEOUT',
      statusCode: 408,
    });

    vi.useRealTimers();
  });
});

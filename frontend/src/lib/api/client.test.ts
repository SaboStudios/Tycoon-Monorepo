import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    clear: () => { store = {}; },
    _store: () => store,
    _seed: (s: Record<string, string>) => { store = { ...s }; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Prevent actual navigation
const assignMock = vi.fn();
vi.stubGlobal('window', { ...globalThis.window, location: { assign: assignMock } });

// Minimal document.cookie stub
let cookieJar = '';
Object.defineProperty(document, 'cookie', {
  get: () => cookieJar,
  set: (v: string) => { cookieJar = v; },
  configurable: true,
});

// ── Helpers ────────────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    statusText: 'OK',
    headers: new Headers(),
  } as unknown as Response;
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('apiClient – 401 refresh token rotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    cookieJar = '';
    assignMock.mockReset();
    localStorageMock._seed({
      accessToken: 'expired-jwt',
      refreshToken: 'valid-refresh',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries after a successful token refresh on 401', async () => {
    // Dynamic import so mocks are in place
    const { apiClient } = await import('./client');

    fetchMock
      // 1st call: original request → 401
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      // 2nd call: refresh endpoint → success
      .mockResolvedValueOnce(
        jsonResponse({ accessToken: 'fresh-jwt', refreshToken: 'fresh-refresh' }),
      )
      // 3rd call: retried original request → success
      .mockResolvedValueOnce(jsonResponse({ data: 'hello' }));

    const result = await apiClient.get('/test');

    expect(result).toEqual({ data: 'hello' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'fresh-jwt');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'fresh-refresh');
  });

  it('clears session and redirects on failed refresh', async () => {
    const { apiClient } = await import('./client');

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'Invalid refresh token' }, 401));

    await expect(apiClient.get('/test')).rejects.toThrow();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
  });

  it('skips 401 handling for public requests', async () => {
    const { apiClient } = await import('./client');

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401));

    await expect(apiClient.get('/public', { public: true })).rejects.toThrow();

    // Only 1 fetch call — no refresh attempt
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces parallel refresh attempts (single-flight)', async () => {
    const { apiClient } = await import('./client');

    fetchMock
      // Two original requests both get 401
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      // Only ONE refresh call
      .mockResolvedValueOnce(
        jsonResponse({ accessToken: 'new-jwt', refreshToken: 'new-refresh' }),
      )
      // Both retries succeed
      .mockResolvedValueOnce(jsonResponse({ a: 1 }))
      .mockResolvedValueOnce(jsonResponse({ b: 2 }));

    const [r1, r2] = await Promise.all([
      apiClient.get('/a'),
      apiClient.get('/b'),
    ]);

    expect(r1).toEqual({ a: 1 });
    expect(r2).toEqual({ b: 2 });

    // Count refresh calls (POST to /auth/refresh)
    const refreshCalls = fetchMock.mock.calls.filter(
      ([url]: [string]) => typeof url === 'string' && url.includes('/auth/refresh'),
    );
    expect(refreshCalls.length).toBeLessThanOrEqual(1);
  });
});

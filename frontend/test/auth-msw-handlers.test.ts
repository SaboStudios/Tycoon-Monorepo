import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { authHandlers } from '../src/mocks/handlers/auth';

const BASE = 'http://localhost:3000';

const server = setupServer(...authHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── POST /auth/wallet-login ──────────────────────────────────────────────────

describe('POST /auth/wallet-login', () => {
  async function walletLogin(body: { address: string; chain: string }) {
    const res = await fetch(`${BASE}/auth/wallet-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  it('returns 200', async () => {
    const res = await fetch(`${BASE}/auth/wallet-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'test.near', chain: 'NEAR' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns accessToken, refreshToken, user', async () => {
    const body = await walletLogin({ address: 'test.near', chain: 'NEAR' });
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('username');
    expect(body.user).toHaveProperty('address');
    expect(body.user).toHaveProperty('chain');
  });

  it('user matches the fixture', async () => {
    const body = await walletLogin({ address: 'test.near', chain: 'NEAR' });
    expect(body.user).toEqual({
      id: 1,
      username: 'testuser',
      address: 'test.near',
      chain: 'NEAR',
    });
  });
});
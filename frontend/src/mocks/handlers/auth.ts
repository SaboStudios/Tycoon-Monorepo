import { http, HttpResponse } from 'msw';

export const authHandlers = [
  // POST /auth/wallet-login
  http.post('/auth/wallet-login', () => {
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: 1,
        username: 'testuser',
        address: 'test.near',
        chain: 'NEAR',
      },
    });
  }),
];
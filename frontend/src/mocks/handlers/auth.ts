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
  http.post('/auth/login', () => {
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  }),
  http.post('/auth/refresh', () => {
    return HttpResponse.json({
      accessToken: 'mock-new-access-token',
      refreshToken: 'mock-new-refresh-token',
    });
  }),
];
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { apiHosts, buildCsp, middleware, SESSION_COOKIE } from './middleware';

function request(pathname: string, cookies: Record<string, string> = {}) {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest(`http://localhost:3000${pathname}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe('middleware auth gate', () => {
  it('redirects /settings to sign-in when there is no session cookie', () => {
    const response = middleware(request('/settings'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/settings');
    expect(response.headers.get('Content-Security-Policy')).toBe(buildCsp());
  });

  it('does not redirect / when there is no session cookie', () => {
    const response = middleware(request('/'));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBe(buildCsp());
  });

  it('allows /settings through when the session cookie is present', () => {
    const response = middleware(request('/settings', { [SESSION_COOKIE]: 'jwt' }));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBe(buildCsp());
  });
});

describe('buildCsp', () => {
  const policy = buildCsp();
  const directives = new Map(
    policy.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources];
    }),
  );

  it('does not allow inline scripts', () => {
    expect(directives.get('script-src')).toEqual(["'self'"]);
    expect(policy).not.toContain('unsafe-inline');
  });

  it('lists explicit image hosts instead of a bare https: scheme', () => {
    const imgSrc = directives.get('img-src') ?? [];
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).not.toContain('https:');
    expect(imgSrc).toContain('https://placehold.co');
  });

  it('keeps object-src and frame-ancestors locked down', () => {
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
  });
});

describe('apiHosts — WebSocket origin derivation (#2152)', () => {
  it('derives ws://localhost:4000 from a NEXT_PUBLIC_BACKEND_URL on a non-default port', () => {
    const hosts = apiHosts({
      NODE_ENV: 'development',
      NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4000',
    });

    expect(hosts).toContain('http://localhost:4000');
    expect(hosts).toContain('ws://localhost:4000');
  });

  it('falls back to the hardcoded localhost ports only when the env vars are unset in development', () => {
    const hosts = apiHosts({ NODE_ENV: 'development' });

    expect(hosts).toContain('http://localhost:3001');
    expect(hosts).toContain('ws://localhost:3001');
    expect(hosts).toContain('http://localhost:3002');
    expect(hosts).toContain('ws://localhost:3002');
  });

  it('does not add any localhost origin in production', () => {
    const hosts = apiHosts({
      NODE_ENV: 'production',
      NEXT_PUBLIC_BACKEND_URL: 'https://api.example.com',
      NEXT_PUBLIC_SHOP_API_URL: 'https://shop.example.com',
    });

    expect(hosts.some((host) => host.includes('localhost'))).toBe(false);
  });
});

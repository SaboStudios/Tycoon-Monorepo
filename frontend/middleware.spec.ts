import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { buildCsp, middleware, SESSION_COOKIE } from './middleware';

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

describe('middleware response CSP header (#2165)', () => {
  it('sets frame-ancestors none and object-src none on the response header', () => {
    // No browser is started: the middleware is invoked directly and the
    // resulting Content-Security-Policy header value is inspected as a string.
    const response = middleware(request('/'));
    const csp = response.headers.get('Content-Security-Policy') ?? '';

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

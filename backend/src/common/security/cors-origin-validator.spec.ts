import { isOriginAllowed } from './cors-origin-validator';

describe('isOriginAllowed', () => {
  const prodOpts = {
    allowedOrigins: ['https://app.example.com'],
    isDevelopment: false,
    devWildcard: false,
  };

  it('allows requests with no origin', () => {
    expect(isOriginAllowed(undefined, prodOpts)).toBe(true);
  });

  it('allows an explicitly allowlisted origin', () => {
    expect(isOriginAllowed('https://app.example.com', prodOpts)).toBe(true);
  });

  it('rejects an origin not on the allowlist in production', () => {
    expect(isOriginAllowed('https://evil.example.com', prodOpts)).toBe(false);
  });

  it('rejects localhost in production even with devWildcard true', () => {
    expect(
      isOriginAllowed('http://localhost:3000', {
        ...prodOpts,
        devWildcard: true,
      }),
    ).toBe(false);
  });

  it('allows localhost in development when devWildcard is enabled', () => {
    expect(
      isOriginAllowed('http://localhost:3000', {
        allowedOrigins: [],
        isDevelopment: true,
        devWildcard: true,
      }),
    ).toBe(true);
  });

  it('allows *.local hosts in development when devWildcard is enabled', () => {
    expect(
      isOriginAllowed('http://myapp.local', {
        allowedOrigins: [],
        isDevelopment: true,
        devWildcard: true,
      }),
    ).toBe(true);
  });

  it('rejects a non-allowlisted origin in development when devWildcard is disabled', () => {
    expect(
      isOriginAllowed('http://localhost:3000', {
        allowedOrigins: [],
        isDevelopment: true,
        devWildcard: false,
      }),
    ).toBe(false);
  });

  it('rejects a malformed origin instead of throwing', () => {
    expect(
      isOriginAllowed('not-a-url', {
        allowedOrigins: [],
        isDevelopment: true,
        devWildcard: true,
      }),
    ).toBe(false);
  });
});

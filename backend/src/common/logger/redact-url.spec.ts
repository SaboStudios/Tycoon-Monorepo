import { redactUrl } from './redact-url';

describe('redactUrl', () => {
  it('leaves URLs without a query untouched', () => {
    expect(redactUrl('/api/v1/users/me')).toBe('/api/v1/users/me');
  });

  it('redacts the data-export download token', () => {
    expect(
      redactUrl('/api/v1/data-export/download?token=eyJhbGciOi.payload.sig'),
    ).toBe('/api/v1/data-export/download?token=[REDACTED]');
  });

  it('redacts sensitive keys case-insensitively and keeps the rest', () => {
    expect(redactUrl('/cb?page=2&Access_Token=abc&sort=asc&API_KEY=x')).toBe(
      '/cb?page=2&Access_Token=[REDACTED]&sort=asc&API_KEY=[REDACTED]',
    );
  });

  it('handles encoded keys and malformed escapes without throwing', () => {
    expect(redactUrl('/x?%74oken=abc')).toBe('/x?%74oken=[REDACTED]');
    expect(redactUrl('/x?%E0%A4%A=1')).toBe('/x?%E0%A4%A=1');
  });
});

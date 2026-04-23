import { sanitizeUploadFilename } from './uploads-logging.util';

describe('sanitizeUploadFilename (SW-BE-009)', () => {
  it('strips path segments', () => {
    expect(sanitizeUploadFilename('/var/lib/nested/avatar.jpg')).toBe('avatar.jpg');
    expect(sanitizeUploadFilename('..\\..\\secret.txt')).toBe('secret.txt');
  });

  it('handles empty input', () => {
    expect(sanitizeUploadFilename('')).toBe('unnamed');
    expect(sanitizeUploadFilename(null as any)).toBe('unnamed');
  });
});

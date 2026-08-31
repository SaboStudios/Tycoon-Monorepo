import { getWsCorsConfig } from './ws.config';

describe('WebSocket CORS Configuration', () => {
  describe('getWsCorsConfig', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should parse WS_CORS_ORIGINS when set', () => {
      process.env.WS_CORS_ORIGINS = 'https://app.example.com,https://www.example.com';
      process.env.NODE_ENV = 'production';

      const config = getWsCorsConfig();
      expect(config.origin).toEqual([
        'https://app.example.com',
        'https://www.example.com',
      ]);
    });

    it('should fall back to CORS_ALLOWED_ORIGINS if WS_CORS_ORIGINS not set', () => {
      delete process.env.WS_CORS_ORIGINS;
      process.env.CORS_ALLOWED_ORIGINS = 'https://fallback.example.com';
      process.env.NODE_ENV = 'production';

      const config = getWsCorsConfig();
      expect(config.origin).toEqual(['https://fallback.example.com']);
    });

    it('should fall back to CORS_ORIGIN if neither WS_CORS_ORIGINS nor CORS_ALLOWED_ORIGINS set', () => {
      delete process.env.WS_CORS_ORIGINS;
      delete process.env.CORS_ALLOWED_ORIGINS;
      process.env.CORS_ORIGIN = 'https://legacy.example.com';

      const config = getWsCorsConfig();
      expect(config.origin).toEqual(['https://legacy.example.com']);
    });

    it('should use default localhost origin if no origins configured', () => {
      delete process.env.WS_CORS_ORIGINS;
      delete process.env.CORS_ALLOWED_ORIGINS;
      delete process.env.CORS_ORIGIN;

      const config = getWsCorsConfig();
      expect(config.origin).toEqual(['http://localhost:3000']);
    });

    it('should trim whitespace from origins', () => {
      process.env.WS_CORS_ORIGINS = '  https://app.example.com  , https://www.example.com  ';
      process.env.NODE_ENV = 'development';

      const config = getWsCorsConfig();
      expect(config.origin).toEqual([
        'https://app.example.com',
        'https://www.example.com',
      ]);
    });

    it('should reject wildcard origin in production', () => {
      process.env.WS_CORS_ORIGINS = '*';
      process.env.NODE_ENV = 'production';

      expect(() => getWsCorsConfig()).toThrow(
        expect.stringMatching(/wildcard.*production/i),
      );
    });

    it('should reject invalid URL origins', () => {
      process.env.WS_CORS_ORIGINS = 'not-a-valid-url,https://valid.example.com';
      process.env.NODE_ENV = 'development';

      expect(() => getWsCorsConfig()).toThrow(
        expect.stringMatching(/Invalid.*CORS origins/i),
      );
    });

    it('should require at least one origin in production', () => {
      process.env.WS_CORS_ORIGINS = '';
      process.env.NODE_ENV = 'production';

      expect(() => getWsCorsConfig()).toThrow(
        expect.stringMatching(/must be configured.*production/i),
      );
    });

    it('should allow empty origins in development', () => {
      process.env.WS_CORS_ORIGINS = '';
      process.env.NODE_ENV = 'development';

      const config = getWsCorsConfig();
      expect(config.origin).toContain('http://localhost:3000');
    });
  });
});

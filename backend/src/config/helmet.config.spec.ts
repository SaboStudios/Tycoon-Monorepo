import { buildHelmetOptions } from './helmet.config';

describe('buildHelmetOptions', () => {
  it('includes upgradeInsecureRequests in production', () => {
    const options = buildHelmetOptions(true);
    const directives = options.contentSecurityPolicy?.directives as Record<
      string,
      unknown
    >;

    expect(directives.upgradeInsecureRequests).toEqual([]);
  });

  it('omits upgradeInsecureRequests outside production', () => {
    const options = buildHelmetOptions(false);
    const directives = options.contentSecurityPolicy?.directives as Record<
      string,
      unknown
    >;

    expect(directives).not.toHaveProperty('upgradeInsecureRequests');
  });

  it('keeps crossOriginEmbedderPolicy disabled in both cases', () => {
    expect(buildHelmetOptions(true).crossOriginEmbedderPolicy).toBe(false);
    expect(buildHelmetOptions(false).crossOriginEmbedderPolicy).toBe(false);
  });
});

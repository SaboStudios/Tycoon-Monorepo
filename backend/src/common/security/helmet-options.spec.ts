import { buildHelmetOptions } from './helmet-options';
import type { ConfigService } from '@nestjs/config';

function makeConfigService(nodeEnv: string): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'app.nodeEnv') return nodeEnv;
      return undefined;
    },
  } as unknown as ConfigService;
}

describe('buildHelmetOptions (issue #1922)', () => {
  describe('in development', () => {
    let opts: ReturnType<typeof buildHelmetOptions>;

    beforeEach(() => {
      opts = buildHelmetOptions(makeConfigService('development'));
    });

    it('sets frameguard action to deny', () => {
      expect(opts.frameguard).toEqual({ action: 'deny' });
    });

    it('sets noSniff to true', () => {
      expect(opts.noSniff).toBe(true);
    });

    it('sets xssFilter to false', () => {
      expect(opts.xssFilter).toBe(false);
    });

    it('sets crossOriginEmbedderPolicy to false (Swagger UI compat)', () => {
      expect(opts.crossOriginEmbedderPolicy).toBe(false);
    });

    it('sets CSP objectSrc to ["\'none\'"]', () => {
      const csp = opts.contentSecurityPolicy as {
        directives: Record<string, string[]>;
      };
      expect(csp.directives.objectSrc).toEqual(["'none'"]);
    });

    it('sets CSP frameAncestors to ["\'none\'"]', () => {
      const csp = opts.contentSecurityPolicy as {
        directives: Record<string, string[]>;
      };
      expect(csp.directives.frameAncestors).toEqual(["'none'"]);
    });

    it('sets CSP defaultSrc to ["\'self\'"]', () => {
      const csp = opts.contentSecurityPolicy as {
        directives: Record<string, string[]>;
      };
      expect(csp.directives.defaultSrc).toEqual(["'self'"]);
    });

    it('does NOT include upgradeInsecureRequests in development', () => {
      const csp = opts.contentSecurityPolicy as {
        directives: Record<string, unknown>;
      };
      expect(csp.directives).not.toHaveProperty('upgradeInsecureRequests');
    });
  });

  describe('in production', () => {
    let opts: ReturnType<typeof buildHelmetOptions>;

    beforeEach(() => {
      opts = buildHelmetOptions(makeConfigService('production'));
    });

    it('includes upgradeInsecureRequests in production', () => {
      const csp = opts.contentSecurityPolicy as {
        directives: Record<string, unknown>;
      };
      expect(csp.directives).toHaveProperty('upgradeInsecureRequests');
    });

    it('still sets frameguard action to deny', () => {
      expect(opts.frameguard).toEqual({ action: 'deny' });
    });

    it('still sets noSniff to true', () => {
      expect(opts.noSniff).toBe(true);
    });

    it('still sets xssFilter to false', () => {
      expect(opts.xssFilter).toBe(false);
    });

    it('still sets CSP objectSrc to ["\'none\'"]', () => {
      const csp = opts.contentSecurityPolicy as {
        directives: Record<string, string[]>;
      };
      expect(csp.directives.objectSrc).toEqual(["'none'"]);
    });

    it('still sets CSP frameAncestors to ["\'none\'"]', () => {
      const csp = opts.contentSecurityPolicy as {
        directives: Record<string, string[]>;
      };
      expect(csp.directives.frameAncestors).toEqual(["'none'"]);
    });
  });
});

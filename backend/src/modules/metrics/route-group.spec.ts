/**
 * SW-BE-028 — route-group: DTO validation and error mapping tests.
 */
import { classifyHttpRouteGroup, httpStatusClass } from './route-group';

describe('classifyHttpRouteGroup', () => {
  // ── internal — /metrics ──────────────────────────────────────────────────

  describe('/metrics paths', () => {
    it('marks /metrics as internal', () => {
      expect(classifyHttpRouteGroup('/metrics')).toBe('internal');
    });

    it('marks /metrics/ (trailing slash) as internal', () => {
      expect(classifyHttpRouteGroup('/metrics/')).toBe('internal');
    });

    it('marks /metrics/sub as internal', () => {
      expect(classifyHttpRouteGroup('/metrics/sub')).toBe('internal');
    });

    it('strips query string before classifying /metrics?debug=1', () => {
      expect(classifyHttpRouteGroup('/metrics?debug=1')).toBe('internal');
    });
  });

  // ── internal — /health ───────────────────────────────────────────────────

  describe('/health paths', () => {
    it('marks /health as internal', () => {
      expect(classifyHttpRouteGroup('/health')).toBe('internal');
    });

    it('marks /health/ (trailing slash) as internal', () => {
      expect(classifyHttpRouteGroup('/health/')).toBe('internal');
    });

    it('marks /health/redis as internal', () => {
      expect(classifyHttpRouteGroup('/health/redis')).toBe('internal');
    });

    it('marks /health/live as internal', () => {
      expect(classifyHttpRouteGroup('/health/live')).toBe('internal');
    });

    it('marks /health/ready as internal', () => {
      expect(classifyHttpRouteGroup('/health/ready')).toBe('internal');
    });

    it('strips query string before classifying /health?verbose=true', () => {
      expect(classifyHttpRouteGroup('/health?verbose=true')).toBe('internal');
    });
  });

  // ── admin ────────────────────────────────────────────────────────────────

  describe('admin paths', () => {
    it('detects /api/v1/admin/waitlist as admin', () => {
      expect(classifyHttpRouteGroup('/api/v1/admin/waitlist')).toBe('admin');
    });

    it('detects /api/v1/admin/logs as admin', () => {
      expect(classifyHttpRouteGroup('/api/v1/admin/logs')).toBe('admin');
    });

    it('detects /admin/users as admin', () => {
      expect(classifyHttpRouteGroup('/admin/users')).toBe('admin');
    });

    it('detects /api/v2/admin/shop as admin', () => {
      expect(classifyHttpRouteGroup('/api/v2/admin/shop')).toBe('admin');
    });

    it('strips query string before classifying admin path', () => {
      expect(classifyHttpRouteGroup('/api/v1/admin/users?page=1')).toBe('admin');
    });
  });

  // ── public ───────────────────────────────────────────────────────────────

  describe('public paths', () => {
    it('classifies /api/v1/shop/items as public', () => {
      expect(classifyHttpRouteGroup('/api/v1/shop/items')).toBe('public');
    });

    it('classifies /api/v1/users/42 as public (numeric segment not a label)', () => {
      expect(classifyHttpRouteGroup('/api/v1/users/42')).toBe('public');
    });

    it('classifies / (root) as public', () => {
      expect(classifyHttpRouteGroup('/')).toBe('public');
    });

    it('classifies /api/v1/games as public', () => {
      expect(classifyHttpRouteGroup('/api/v1/games')).toBe('public');
    });

    it('strips query string before classifying public path', () => {
      expect(classifyHttpRouteGroup('/api/v1/shop?page=2&limit=10')).toBe('public');
    });

    it('does not misclassify "administrator" as admin segment', () => {
      expect(classifyHttpRouteGroup('/api/v1/administrator')).toBe('public');
    });
  });
});

// ── httpStatusClass ──────────────────────────────────────────────────────────

describe('httpStatusClass', () => {
  it('maps 200 to 2xx', () => expect(httpStatusClass(200)).toBe('2xx'));
  it('maps 201 to 2xx', () => expect(httpStatusClass(201)).toBe('2xx'));
  it('maps 204 to 2xx', () => expect(httpStatusClass(204)).toBe('2xx'));
  it('maps 301 to 3xx', () => expect(httpStatusClass(301)).toBe('3xx'));
  it('maps 304 to 3xx', () => expect(httpStatusClass(304)).toBe('3xx'));
  it('maps 400 to 4xx', () => expect(httpStatusClass(400)).toBe('4xx'));
  it('maps 401 to 4xx', () => expect(httpStatusClass(401)).toBe('4xx'));
  it('maps 403 to 4xx', () => expect(httpStatusClass(403)).toBe('4xx'));
  it('maps 404 to 4xx', () => expect(httpStatusClass(404)).toBe('4xx'));
  it('maps 422 to 4xx', () => expect(httpStatusClass(422)).toBe('4xx'));
  it('maps 500 to 5xx', () => expect(httpStatusClass(500)).toBe('5xx'));
  it('maps 502 to 5xx', () => expect(httpStatusClass(502)).toBe('5xx'));
  it('maps 503 to 5xx', () => expect(httpStatusClass(503)).toBe('5xx'));
});

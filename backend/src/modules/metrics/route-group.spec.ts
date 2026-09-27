import { classifyHttpRouteGroup, httpStatusClass } from './route-group';

describe('classifyHttpRouteGroup', () => {
  it('marks /metrics as internal', () => {
    expect(classifyHttpRouteGroup('/metrics')).toBe('internal');
  });

  it('marks health as internal', () => {
    expect(classifyHttpRouteGroup('/health/redis')).toBe('internal');
  });

  it('detects admin routes without embedding user ids', () => {
    expect(classifyHttpRouteGroup('/api/v1/admin/waitlist')).toBe('admin');
    expect(classifyHttpRouteGroup('/api/v1/admin/logs')).toBe('admin');
  });

  it('does not treat numeric path segments as labels', () => {
    expect(classifyHttpRouteGroup('/api/v1/users/42')).toBe('public');
  });

  it('classifies public API', () => {
    expect(classifyHttpRouteGroup('/api/v1/shop/items')).toBe('public');
  });
});

describe('httpStatusClass', () => {
  it('maps status codes to classes', () => {
    expect(httpStatusClass(200)).toBe('2xx');
    expect(httpStatusClass(404)).toBe('4xx');
    expect(httpStatusClass(500)).toBe('5xx');
  });
});

import { uploadsRouteLabel } from './uploads-observability.interceptor';

describe('uploadsRouteLabel (SW-BE-009)', () => {
  it('maps known paths to stable route buckets', () => {
    expect(uploadsRouteLabel('/api/v1/uploads/avatar')).toBe('avatar');
    expect(uploadsRouteLabel('/uploads/admin/assets')).toBe('admin_asset');
    expect(uploadsRouteLabel('/uploads/signed-url?k=1')).toBe('signed_url');
    expect(uploadsRouteLabel('/uploads/download')).toBe('download');
    expect(uploadsRouteLabel('/uploads-enhanced/batch')).toBe('batch');
  });
});

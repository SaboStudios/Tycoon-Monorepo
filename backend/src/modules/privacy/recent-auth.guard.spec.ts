import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecentAuthGuard, STEP_UP_REQUIRED } from './recent-auth.guard';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { DataExportMetrics } from './data-export.metrics';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const now = () => Math.floor(Date.now() / 1000);

function buildContext(user: Partial<JwtPayload> | undefined) {
  const res = { setHeader: jest.fn() };
  const req = { user, ip: '203.0.113.7', headers: { 'user-agent': 'jest' } };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { ctx, res };
}

describe('RecentAuthGuard (#1766 step-up)', () => {
  let guard: RecentAuthGuard;
  let audit: { log: jest.Mock };
  let metrics: { recordRequest: jest.Mock };
  let settings: Record<string, unknown>;

  beforeEach(() => {
    settings = {
      'app.dataExportStepUpMaxAgeSeconds': 300,
      'app.dataExportStepUpMethods': ['pwd', 'wallet'],
    };
    const config = { get: jest.fn((key: string) => settings[key]) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    metrics = { recordRequest: jest.fn() };
    guard = new RecentAuthGuard(
      config as unknown as ConfigService,
      audit as unknown as AuditTrailService,
      metrics as unknown as DataExportMetrics,
    );
  });

  const base = { id: 7, sub: 7, email: 'x@example.com', role: 'user', is_admin: false };

  it('allows a token from a fresh password login', () => {
    const { ctx } = buildContext({ ...base, auth_time: now() - 10, amr: ['pwd'] });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('allows a token from a fresh wallet login', () => {
    const { ctx } = buildContext({ ...base, auth_time: now(), amr: ['wallet'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it.each([
    ['refreshed token (no auth_time)', { amr: ['pwd'] }, 'missing_auth_time'],
    ['stale login', { auth_time: now() - 301, amr: ['pwd'] }, 'stale'],
    ['auth_time in the future (spoofed/clock abuse)', { auth_time: now() + 3600, amr: ['pwd'] }, 'future_auth_time'],
    ['no amr', { auth_time: now() }, 'method_not_allowed'],
  ])('rejects %s with 401 STEP_UP_REQUIRED', (_label, claims, reason) => {
    const { ctx, res } = buildContext({ ...base, ...claims });

    let thrown: unknown;
    try {
      guard.canActivate(ctx);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(UnauthorizedException);
    expect((thrown as UnauthorizedException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 401, error: STEP_UP_REQUIRED }),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('insufficient_user_authentication'),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('max_age=300'),
    );
    expect(metrics.recordRequest).toHaveBeenCalledWith('step_up_required');
    expect(audit.log).toHaveBeenCalledWith(
      AuditAction.DATA_EXPORT_STEP_UP_FAILED,
      expect.objectContaining({ userId: 7, changes: { reason } }),
    );
  });

  it('rejects a method that operators have disallowed', () => {
    settings['app.dataExportStepUpMethods'] = ['pwd'];
    const { ctx } = buildContext({ ...base, auth_time: now(), amr: ['wallet'] });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('honours a configured max age', () => {
    settings['app.dataExportStepUpMaxAgeSeconds'] = 60;
    const { ctx } = buildContext({ ...base, auth_time: now() - 90, amr: ['pwd'] });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('denies by default when there is no authenticated principal', () => {
    const { ctx } = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('never puts the email or token into the audit row', () => {
    const { ctx } = buildContext({ ...base, amr: ['pwd'] });
    expect(() => guard.canActivate(ctx)).toThrow();
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('x@example.com');
  });

  it('does not fail the request path when the audit write rejects', async () => {
    audit.log.mockRejectedValue(new Error('db down'));
    const { ctx } = buildContext({ ...base, amr: ['pwd'] });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    await new Promise((r) => setImmediate(r));
  });
});

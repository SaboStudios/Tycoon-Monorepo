/**
 * #872 Module auth — observability (logs, traces, metrics)
 *
 * Covers:
 *  - Counter increments for login/wallet/admin/register attempts.
 *  - Histogram timer returns a callable end function.
 *  - Token refresh result labels are recorded correctly.
 *  - Token reuse increments both the refresh counter and the reuse counter.
 *  - Logger.warn is called on reuse; Logger.log on normal events.
 *  - No secrets or tokens appear in log output.
 */

import { Logger } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { AuthObservabilityService } from './auth-observability.service';

jest.mock('prom-client', () => {
  const incMock = jest.fn();
  const startTimerMock = jest.fn().mockReturnValue(jest.fn());

  const Counter = jest.fn().mockImplementation(() => ({ inc: incMock }));
  const Histogram = jest.fn().mockImplementation(() => ({
    startTimer: startTimerMock,
  }));

  return { Counter, Histogram, incMock, startTimerMock };
});

function getPromMocks() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const prom = require('prom-client') as {
    incMock: jest.Mock;
    startTimerMock: jest.Mock;
  };
  return prom;
}

describe('AuthObservabilityService (#872)', () => {
  let service: AuthObservabilityService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthObservabilityService();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Counter — auth attempts
  // -------------------------------------------------------------------------

  describe('recordAuthAttempt', () => {
    it.each([
      ['login', 'success'],
      ['login', 'failure'],
      ['login', 'suspended'],
      ['wallet_login', 'success'],
      ['admin_login', 'failure'],
      ['register', 'success'],
    ] as const)('increments counter for %s / %s', (operation, result) => {
      const { incMock } = getPromMocks();
      service.recordAuthAttempt(operation, result);
      expect(incMock).toHaveBeenCalledWith({ operation, result });
    });

    it('logs at info level on success', () => {
      service.recordAuthAttempt('login', 'success');
      expect(logSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs at info level on failure (warn is for reuse only)', () => {
      service.recordAuthAttempt('login', 'failure');
      expect(logSpy).toHaveBeenCalled();
    });

    it('log message does not contain secrets', () => {
      service.recordAuthAttempt('login', 'success');
      const logArgs = logSpy.mock.calls.flat().join(' ');
      expect(logArgs).not.toMatch(/password|token|secret|hash/i);
    });
  });

  // -------------------------------------------------------------------------
  // Counter — token refresh
  // -------------------------------------------------------------------------

  describe('recordTokenRefresh', () => {
    it.each(['success', 'failure', 'expired', 'reuse'] as const)(
      'increments refresh counter for result=%s',
      (result) => {
        const { incMock } = getPromMocks();
        service.recordTokenRefresh(result);
        expect(incMock).toHaveBeenCalledWith({ result });
      },
    );

    it('increments reuse counter and logs warn on reuse', () => {
      const { incMock } = getPromMocks();
      service.recordTokenRefresh('reuse');
      // Called twice: once for refresh counter, once for reuse counter
      expect(incMock).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('does NOT call warn for non-reuse results', () => {
      service.recordTokenRefresh('success');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('reuse warn message does not contain raw token data', () => {
      service.recordTokenRefresh('reuse');
      const warnArgs = warnSpy.mock.calls.flat().join(' ');
      expect(warnArgs).not.toMatch(/[a-f0-9]{32,}/i);
    });
  });

  // -------------------------------------------------------------------------
  // Histogram — operation timer
  // -------------------------------------------------------------------------

  describe('startTimer', () => {
    it('returns a callable end function', () => {
      const { startTimerMock } = getPromMocks();
      const end = service.startTimer('login');
      expect(startTimerMock).toHaveBeenCalledWith({ operation: 'login' });
      expect(typeof end).toBe('function');
    });

    it('end function is callable without throwing', () => {
      const end = service.startTimer('token_refresh');
      expect(() => end()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Metric registration — counters and histograms are created
  // -------------------------------------------------------------------------

  describe('metric registration', () => {
    it('creates 3 Counter instances', () => {
      expect(Counter).toHaveBeenCalledTimes(3);
    });

    it('creates 1 Histogram instance', () => {
      expect(Histogram).toHaveBeenCalledTimes(1);
    });

    it('auth_attempts counter has correct name', () => {
      const calls = (Counter as jest.Mock).mock.calls as [{ name: string }][];
      const names = calls.map((c) => c[0].name);
      expect(names).toContain('tycoon_auth_attempts_total');
    });

    it('token_reuse counter has correct name', () => {
      const calls = (Counter as jest.Mock).mock.calls as [{ name: string }][];
      const names = calls.map((c) => c[0].name);
      expect(names).toContain('tycoon_auth_token_reuse_detected_total');
    });

    it('histogram has correct name', () => {
      const calls = (Histogram as jest.Mock).mock.calls as [{ name: string }][];
      expect(calls[0][0].name).toBe('tycoon_auth_operation_duration_seconds');
    });
  });
});

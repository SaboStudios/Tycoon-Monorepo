import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class AuthObservabilityService {
  private readonly logger = new Logger(AuthObservabilityService.name);

  private readonly authAttemptsTotal: Counter;
  private readonly authOperationDuration: Histogram;
  private readonly tokenRefreshTotal: Counter;
  private readonly tokenReuseTotal: Counter;
  private readonly failedLoginsTotal: Counter;

  constructor() {
    this.authAttemptsTotal = new Counter({
      name: 'tycoon_auth_attempts_total',
      help: 'Total auth attempts by operation and result',
      labelNames: ['operation', 'result'],
    });

    this.authOperationDuration = new Histogram({
      name: 'tycoon_auth_operation_duration_seconds',
      help: 'Duration of auth operations in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    });

    this.tokenRefreshTotal = new Counter({
      name: 'tycoon_auth_token_refresh_total',
      help: 'Total token refresh attempts by result',
      labelNames: ['result'],
    });

    this.tokenReuseTotal = new Counter({
      name: 'tycoon_auth_token_reuse_detected_total',
      help: 'Total token reuse / replay attack detections',
    });

    this.failedLoginsTotal = new Counter({
      name: 'tycoon_auth_failed_logins_total',
      help: 'Total failed login attempts by reason code (no PII)',
      labelNames: ['reason'],
    });
  }

  recordAuthAttempt(
    operation: 'login' | 'wallet_login' | 'admin_login' | 'register',
    result: 'success' | 'failure' | 'suspended',
  ): void {
    this.authAttemptsTotal.inc({ operation, result });
    this.logger.log(
      `[METRIC] auth_attempt operation=${operation} result=${result}`,
    );
  }

  recordTokenRefresh(
    result: 'success' | 'failure' | 'expired' | 'reuse',
  ): void {
    this.tokenRefreshTotal.inc({ result });
    if (result === 'reuse') {
      this.tokenReuseTotal.inc();
      this.logger.warn('[METRIC] token_reuse_detected');
    }
  }

  startTimer(operation: string): () => void {
    return this.authOperationDuration.startTimer({ operation });
  }

  /**
   * Records a failed login by reason code only — never pass email, IP,
   * or any user-identifying value here.
   */
  recordFailedLogin(
    reason: 'unknown_user' | 'invalid_password' | 'suspended' | 'invalid_credentials',
  ): void {
    this.failedLoginsTotal.inc({ reason });
    this.logger.log(`[METRIC] auth_failed_login reason=${reason}`);
  }
}

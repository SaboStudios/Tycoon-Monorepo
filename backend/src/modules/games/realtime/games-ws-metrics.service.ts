import { Injectable } from '@nestjs/common';
import { Counter, Gauge } from 'prom-client';
import { HttpMetricsService } from '../../metrics/http-metrics.service';
import { GameActionErrorCode } from './game-action.error';

/**
 * WebSocket metrics for the /games namespace (runbook § Rate limiting and
 * metrics). Labels carry only stable error codes — no user ids, no tokens,
 * no PII (ADR-002 security constraints).
 */
@Injectable()
export class GamesWsMetrics {
  private readonly connectedSockets: Gauge;
  private readonly rejectedActions: Counter;
  private readonly teardowns: Counter;
  private readonly adapterPublishFailures: Counter;
  private readonly rateLimitRejections: Counter;

  constructor(httpMetrics: HttpMetricsService) {
    const registers = [httpMetrics.registry];

    this.connectedSockets = new Gauge({
      name: 'tycoon_games_ws_connected_sockets',
      help: 'Currently connected sockets on the /games namespace',
      registers,
    });

    this.rejectedActions = new Counter({
      name: 'tycoon_games_ws_rejected_actions_total',
      help: 'Rejected /games actions by stable error code',
      labelNames: ['code'],
      registers,
    });

    this.teardowns = new Counter({
      name: 'tycoon_games_ws_teardowns_total',
      help: 'Ban/force-end socket teardowns (game:unsubscribed emissions)',
      labelNames: ['reason'],
      registers,
    });

    this.adapterPublishFailures = new Counter({
      name: 'tycoon_games_ws_adapter_publish_failures_total',
      help: 'Redis adapter publish failures (fan-out degraded to local instance)',
      registers,
    });

    this.rateLimitRejections = new Counter({
      name: 'tycoon_games_ws_rate_limited_total',
      help: 'Join/roll intents rejected by the per-socket/per-user rate limiter',
      labelNames: ['action'],
      registers,
    });
  }

  socketConnected(): void {
    this.connectedSockets.inc();
  }

  socketDisconnected(): void {
    this.connectedSockets.dec();
  }

  rejected(code: GameActionErrorCode): void {
    this.rejectedActions.inc({ code });
  }

  teardown(reason: string): void {
    this.teardowns.inc({ reason });
  }

  adapterPublishFailure(): void {
    this.adapterPublishFailures.inc();
  }

  rateLimited(action: 'join' | 'roll' | 'end-turn' | 'chat'): void {
    this.rateLimitRejections.inc({ action });
  }
}

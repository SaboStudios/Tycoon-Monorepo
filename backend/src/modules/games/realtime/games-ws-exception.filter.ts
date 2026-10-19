import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  GameActionError,
  GameActionErrorCode,
  toGameActionError,
} from './game-action.error';
import { GAMES_SCHEMA_VERSION } from './games-snapshot.service';
import { GamesWsMetrics } from './games-ws-metrics.service';

/**
 * Normalizes anything thrown inside the /games namespace into the stable
 * `game:error` envelope:
 *
 *   { schemaVersion, code, message, requestId? }
 *
 * Guards throw `WsException(GameActionError.toPayload())`; services throw
 * HttpExceptions that map onto the same code vocabulary via
 * `toGameActionError`. Unrecognized failures collapse to INTERNAL_ERROR so
 * internal details never leak to clients (ADR-002 §1, runbook § Stable error
 * codes).
 */
@Catch()
export class GamesWsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GamesWsExceptionFilter.name);

  constructor(private readonly metrics: GamesWsMetrics) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const actionError = this.normalize(exception);

    this.metrics.rejected(actionError.code);
    if (actionError.code === GameActionErrorCode.INTERNAL_ERROR) {
      this.logger.error(
        `Unhandled WS error: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    client?.emit?.('game:error', {
      schemaVersion: GAMES_SCHEMA_VERSION,
      ...actionError.toPayload(),
    });
  }

  private normalize(exception: unknown): GameActionError {
    if (exception instanceof WsException) {
      const error = exception.getError();
      if (typeof error === 'object' && error !== null) {
        const payload = error as { code?: unknown; message?: unknown };
        const code = payload.code;
        if (
          typeof code === 'string' &&
          Object.values(GameActionErrorCode).includes(
            code as GameActionErrorCode,
          )
        ) {
          return new GameActionError(code as GameActionErrorCode, {
            message:
              typeof payload.message === 'string'
                ? payload.message
                : (code as GameActionErrorCode),
          });
        }
      }
      return new GameActionError(GameActionErrorCode.INTERNAL_ERROR, {
        message: 'Internal error',
      });
    }
    return toGameActionError(exception);
  }
}

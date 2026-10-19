import { Logger, type INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions, Server } from 'socket.io';

export interface RedisSocketConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

/**
 * Socket.IO adapter wiring for the /games namespace (ADR-002 §4).
 *
 * With Redis configured, events fan out across all gateway instances through
 * the Socket.IO Redis adapter. Local delivery never depends on Redis —
 * `broadcast()` publishes first and then always delivers on the local
 * instance — so a Redis partition degrades to per-instance delivery while
 * the gateway keeps serving (clients fall back to REST polling for
 * cross-instance state until the adapter reconnects).
 *
 * Publish failures are swallowed into a metric/log instead of becoming
 * unhandled promise rejections, and both Redis clients get error handlers so
 * an outage cannot crash the process.
 */
export class GamesIoAdapter extends IoAdapter {
  private readonly logger = new Logger(GamesIoAdapter.name);

  constructor(
    app: INestApplication,
    private readonly redisConfig: RedisSocketConfig | undefined,
    private readonly onPublishError?: (err: Error) => void,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: true, credentials: true },
    }) as Server;

    if (!this.redisConfig) {
      this.logger.warn(
        'Redis config missing; /games fan-out is limited to this instance',
      );
      return server;
    }

    try {
      const pub = new Redis({
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
        db: this.redisConfig.db,
        lazyConnect: false,
      });
      const sub = pub.duplicate();

      const attachErrorHandler = (client: Redis, label: string) => {
        client.on('error', (err: Error) => {
          this.logger.warn(
            `Redis ${label} client error (fan-out degraded to local): ${err.message}`,
          );
        });
      };
      attachErrorHandler(pub, 'publisher');
      attachErrorHandler(sub, 'subscriber');

      // Surface publish failures (metric) without turning them into
      // unhandled rejections; local broadcast still runs unconditionally.
      const originalPublish = pub.publish.bind(pub) as Redis['publish'];
      pub.publish = ((...args: Parameters<Redis['publish']>) => {
        try {
          const result = originalPublish(...args);
          void Promise.resolve(result).catch((err: Error) => {
            this.onPublishError?.(err);
          });
          return result;
        } catch (err) {
          this.onPublishError?.(err as Error);
          throw err;
        }
      }) as Redis['publish'];

      server.adapter(createAdapter(pub, sub));
      this.logger.log(
        `Redis adapter attached (ws fan-out: ${this.redisConfig.host}:${this.redisConfig.port})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to attach Redis adapter; degrading to per-instance fan-out: ${
          (err as Error).message
        }`,
      );
    }

    return server;
  }
}

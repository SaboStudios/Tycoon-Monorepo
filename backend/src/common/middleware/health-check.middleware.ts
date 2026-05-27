import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface HealthCheckMiddlewareOptions {
  serviceName?: string;
  version?: string;
  checks?: Record<string, () => Promise<boolean>>;
}

@Injectable()
export class HealthCheckMiddleware implements NestMiddleware {
  private readonly options: HealthCheckMiddlewareOptions;

  constructor() {
    this.options = {
      serviceName: 'tycoon-backend',
      version: process.env.npm_package_version || '1.0.0',
    };
  }

  async use(req: Request, res: Response, next: NextFunction) {
    if (!req.path.endsWith('/health/status')) {
      return next();
    }

    try {
      const checksResults: Record<string, boolean> = {};

      if (this.options.checks) {
        for (const [name, checkFn] of Object.entries(this.options.checks)) {
          try {
            checksResults[name] = await checkFn();
          } catch {
            checksResults[name] = false;
          }
        }
      }

      const allHealthy = Object.values(checksResults).every((v) => v !== false);

      return res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        service: this.options.serviceName,
        version: this.options.version,
        timestamp: new Date().toISOString(),
        checks: checksResults,
      });
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        service: this.options.serviceName,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

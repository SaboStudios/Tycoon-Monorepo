import { Request, Response } from 'express';

export interface HealthCheckOptions {
    serviceName: string;
    version?: string;
    checks?: Record<string, () => Promise<boolean>>;
}

export class HealthCheckMiddleware {
    constructor(private options: HealthCheckOptions) { }

    check = async (req: Request, res: Response) => {
        try {
            const checksResults: Record<string, boolean> = {};

            if (this.options.checks) {
                for (const [name, checkFn] of Object.entries(this.options.checks)) {
                    try {
                        checksResults[name] = await checkFn();
                    } catch (error) {
                        checksResults[name] = false;
                    }
                }
            }

            const allHealthy = Object.values(checksResults).every((v) => v !== false);

            res.status(allHealthy ? 200 : 503).json({
                status: allHealthy ? 'healthy' : 'degraded',
                service: this.options.serviceName,
                version: this.options.version || '1.0.0',
                timestamp: new Date().toISOString(),
                checks: checksResults,
            });
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                service: this.options.serviceName,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            });
        }
    };
}

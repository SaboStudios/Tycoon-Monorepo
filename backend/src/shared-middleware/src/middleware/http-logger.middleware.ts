import { Request, Response, NextFunction } from 'express';
import { LoggerConfig } from '../config/logger.config';

export class HttpLoggerMiddleware {
    constructor(private loggerConfig: LoggerConfig) { }

    log = (req: Request, res: Response, next: NextFunction) => {
        if (this.shouldSkip(req.path)) {
            return next();
        }

        const startTime = Date.now();
        const originalSend = res.send;

        res.send = function (data: any) {
            const duration = Date.now() - startTime;
            const logEntry = {
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                userAgent: req.get('user-agent'),
                ip: req.ip,
            };

            if (this.loggerConfig.format === 'json') {
                console.log(JSON.stringify(logEntry));
            } else {
                console.log(
                    `[${logEntry.timestamp}] ${logEntry.method} ${logEntry.path} - ${logEntry.statusCode} (${logEntry.duration})`,
                );
            }

            return originalSend.call(this, data);
        }.bind(this);

        next();
    };

    private shouldSkip(path: string): boolean {
        return this.loggerConfig.excludePaths?.some((p) => path.startsWith(p)) ?? false;
    }
}

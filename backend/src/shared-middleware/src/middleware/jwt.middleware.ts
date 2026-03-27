import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { RequestWithUser } from '../types/request-with-user';
import { JwtConfig } from '../config/jwt.config';

export class JwtMiddleware {
    constructor(private jwtConfig: JwtConfig) { }

    authenticate = (req: RequestWithUser, res: Response, next: NextFunction) => {
        const token = this.extractToken(req);

        if (!token) {
            return res.status(401).json({
                statusCode: 401,
                message: 'Unauthorized',
                error: 'No token provided',
                timestamp: new Date().toISOString(),
            });
        }

        try {
            const decoded = jwt.verify(token, this.jwtConfig.secret);
            req.user = decoded as RequestWithUser['user'];
            next();
        } catch (error) {
            const message =
                error instanceof jwt.TokenExpiredError
                    ? 'Token expired'
                    : 'Invalid token';
            return res.status(401).json({
                statusCode: 401,
                message: 'Unauthorized',
                error: message,
                timestamp: new Date().toISOString(),
            });
        }
    };

    private extractToken(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (!authHeader) return null;

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

        return parts[1];
    }
}

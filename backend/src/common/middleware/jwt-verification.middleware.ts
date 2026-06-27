import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

@Injectable()
export class JwtVerificationMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const token = this.extractToken(req);

    if (!token) {
      return next(
        new UnauthorizedException({
          statusCode: 401,
          message: 'Unauthorized',
          error: 'No token provided',
        }),
      );
    }

    try {
      const secret =
        this.configService.get<string>('jwt.secret') || 'default-secret';
      const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
      (req as Request & { user?: JwtPayload }).user = decoded;
      next();
    } catch (error) {
      const message =
        error instanceof jwt.TokenExpiredError
          ? 'Token expired'
          : 'Invalid token';
      return next(
        new UnauthorizedException({
          statusCode: 401,
          message: 'Unauthorized',
          error: message,
        }),
      );
    }
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}

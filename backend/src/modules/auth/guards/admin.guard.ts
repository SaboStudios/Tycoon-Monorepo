import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * AdminGuard - Use this guard to restrict access to admin-only endpoints.
 * It checks if the authenticated user has the is_admin flag set to true.
 * Apply with @UseGuards(AdminGuard) decorator.
 * Usually paired with @UseGuards(JwtAuthGuard) to ensure the user is authenticated first.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!user || user.is_admin !== true) {
      throw new ForbiddenException('Access denied. Admin role required.');
    }

    return true;
  }
}

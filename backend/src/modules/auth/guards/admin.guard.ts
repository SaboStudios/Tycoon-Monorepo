import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

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
        const request = context.switchToHttp().getRequest();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const user = request.user as { is_admin?: boolean } | undefined;

        if (!user || user.is_admin !== true) {
            throw new ForbiddenException('Access denied. Admin role required.');
        }

        return true;
    }
}

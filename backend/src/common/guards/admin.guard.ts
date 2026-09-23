import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../../modules/auth/enums/role.enum';

/**
 * AdminGuard enforces deny-by-default admin authorization for every route it
 * protects. It is intended to be applied at the class level together with
 * JwtAuthGuard, e.g.:
 *
 *   @UseGuards(JwtAuthGuard, AdminGuard)
 *   @Controller('admin/...')
 *
 * This mirrors ADMIN_ROUTES_MATRIX.md and is validated in CI by
 * backend/scripts/verify-admin-guards.ts, which asserts that every admin
 * controller declares both guards at the class level.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Deny-by-default: only an explicit admin role or admin flag grants access.
    // Any other role (including missing/unknown roles) is rejected.
    const isAdmin = user.role === Role.ADMIN || user.is_admin === true;

    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}

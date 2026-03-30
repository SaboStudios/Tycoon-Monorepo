import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

/**
 * RolesGuard - Use this guard to restrict access based on user roles.
 * It checks if the authenticated user has one of the required roles specified via @Roles() decorator.
 * Apply with @UseGuards(RolesGuard) and @Roles(...roles) decorators.
 * Usually paired with @UseGuards(JwtAuthGuard) to ensure the user is authenticated first.
 *
 * IMPORTANT: This guard implements default deny behavior.
 * If no @Roles() decorator is present, access is DENIED.
 * This ensures routes are explicitly marked with required roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Default deny: if no roles are specified, deny access
    // This ensures routes must explicitly declare required roles
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Access denied. No roles specified for this route.',
      );
    }

    const { user } = context.switchToHttp().getRequest<{
      user: { role: Role };
    }>();

    // Check if user is missing or has no role
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied. User role not found.');
    }

    // Check if user has one of the required roles
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

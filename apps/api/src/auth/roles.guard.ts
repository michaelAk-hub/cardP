import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@blue-card/shared';
import { ROLES_KEY } from './decorators';
import { AuthPrincipal } from './auth.types';

// Enforces @Roles(...). Runs after JwtAuthGuard, so request.user is set.
// Any @Roles route implies an admin principal.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthPrincipal }>();

    if (!user || user.type !== 'admin' || !user.role) {
      throw new ForbiddenException('Admin access required');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@blue-card/shared';
import { RolesGuard } from './roles.guard';
import { AuthPrincipal } from './auth.types';

function contextFor(
  user: AuthPrincipal | undefined,
): ExecutionContext {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: AdminRole[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const guard = guardRequiring(undefined);
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('allows a root for a root-only route', () => {
    const guard = guardRequiring([AdminRole.Root]);
    const ctx = contextFor({ id: 'a', type: 'admin', role: AdminRole.Root });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('forbids a protoporia admin on a root-only route', () => {
    const guard = guardRequiring([AdminRole.Root]);
    const ctx = contextFor({ id: 'a', type: 'admin', role: AdminRole.Protoporia });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('forbids a student principal on an admin route', () => {
    const guard = guardRequiring([AdminRole.Protoporia]);
    const ctx = contextFor({ id: 's', type: 'student' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

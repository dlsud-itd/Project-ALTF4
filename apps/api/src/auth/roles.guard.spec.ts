import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows matching staff role', () => {
    const handler = function handler() {};
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: AccessRole.STAFF } }),
      }),
    } as any;

    Reflect.defineMetadata(ROLES_KEY, [AccessRole.STAFF, AccessRole.ADMIN], handler);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects users without the required role', () => {
    const handler = function handler() {};
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: AccessRole.PATIENT } }),
      }),
    } as any;

    Reflect.defineMetadata(ROLES_KEY, [AccessRole.STAFF, AccessRole.ADMIN], handler);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

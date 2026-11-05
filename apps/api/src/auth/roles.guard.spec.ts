import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { AccessRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows matching staff role', () => {
    const handler = function handler() {};
    class TestController {}
    const context = new ExecutionContextHost(
      [{ user: { role: AccessRole.STAFF } }],
      TestController,
      handler,
    );

    Reflect.defineMetadata(
      ROLES_KEY,
      [AccessRole.STAFF, AccessRole.ADMIN],
      handler,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects users without the required role', () => {
    const handler = function handler() {};
    class TestController {}
    const context = new ExecutionContextHost(
      [{ user: { role: AccessRole.PATIENT } }],
      TestController,
      handler,
    );

    Reflect.defineMetadata(
      ROLES_KEY,
      [AccessRole.STAFF, AccessRole.ADMIN],
      handler,
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

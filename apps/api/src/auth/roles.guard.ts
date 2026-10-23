import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<AccessRole | string>>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Forbidden: insufficient permissions');
    }

    const normalizedUserRole = String(user.role).toUpperCase();
    const allowedRoles = requiredRoles.map((role) => String(role).toUpperCase());

    if (!allowedRoles.includes(normalizedUserRole)) {
      throw new ForbiddenException('Forbidden: insufficient permissions');
    }

    return true;
  }
}

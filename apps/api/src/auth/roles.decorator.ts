import { SetMetadata } from '@nestjs/common';
import { AccessRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: Array<AccessRole | string>) =>
  SetMetadata(ROLES_KEY, roles);

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    error: unknown,
    user: TUser | null | false,
  ): TUser {
    if (error || !user) {
      throw new UnauthorizedException('Unauthorized: invalid or expired token');
    }
    return user;
  }
}

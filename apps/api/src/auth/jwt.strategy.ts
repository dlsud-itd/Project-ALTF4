import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  jti: string;
  exp: number;
}

export interface AuthenticatedUser {
  id: number;
  fullName: string;
  email: string;
  affiliation: string;
  role: string;
  isActive: boolean;
  tokenId: string;
  tokenExpiresAt: Date;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (
      !Number.isInteger(payload.sub) ||
      typeof payload.jti !== 'string' ||
      !payload.jti ||
      !Number.isFinite(payload.exp)
    ) {
      throw new UnauthorizedException('Unauthorized: invalid or expired token');
    }

    const revokedToken = await this.prisma.revokedToken.findUnique({
      where: { tokenId: payload.jti },
    });
    if (revokedToken) {
      throw new UnauthorizedException('Unauthorized: invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        fullName: true,
        email: true,
        affiliation: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Unauthorized: invalid or expired token');
    }

    return {
      ...user,
      tokenId: payload.jti,
      tokenExpiresAt: new Date(payload.exp * 1000),
    };
  }
}

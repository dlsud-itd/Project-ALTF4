import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AccessRole } from '@prisma/client';
import { successResponse } from '../common/api-response';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    let user: { id: number };
    try {
      user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          passwordHash,
          affiliation: dto.affiliation,
          role: AccessRole.PATIENT,
          isActive: true,
        },
        select: { id: true },
      });
    } catch (error) {
      const target =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.meta?.target
          : undefined;
      const emailConflict =
        (Array.isArray(target) && target.includes('email')) ||
        (typeof target === 'string' && target.toLowerCase().includes('email'));
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        emailConflict
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }

    return successResponse('User registered successfully', { userId: user.id });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign({ ...payload, jti: randomUUID() });

    return successResponse('Login successful', {
      userId: user.id,
      role: user.role.toLowerCase(),
      accessToken,
    });
  }

  async logout(tokenId: string, expiresAt: Date) {
    await this.prisma.revokedToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await this.prisma.revokedToken.create({
      data: { tokenId, expiresAt },
    });

    return successResponse('Logged out successfully', {});
  }
}

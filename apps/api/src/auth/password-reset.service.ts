import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import {
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_SECOND,
  PASSWORD_RESET_DEFAULT_EXPIRY_MINUTES,
  PASSWORD_RESET_DEFAULT_MAX_ATTEMPTS,
  PASSWORD_RESET_DEFAULT_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RESET_MAX_REQUESTS_PER_EMAIL,
  PASSWORD_RESET_MAX_REQUESTS_PER_IP,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
} from '../common/clinic.constants';
import { successResponse } from '../common/api-response';
import { EmailChannelService } from '../notifications/channels/email-channel.service';
import { buildPasswordResetOtpEmail } from '../notifications/notification-events';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateNumericOtp,
  generateResetProofToken,
  hashOtpOrToken,
  verifyOtpOrTokenHash,
} from './otp.util';
import { hashPassword } from './password.util';

const GENERIC_OTP_SENT_MESSAGE =
  'If this email is registered, a verification code has been sent.';

@Injectable()
export class PasswordResetService {
  private readonly otpExpiryMinutes: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownSeconds: number;
  private readonly otpSecret: string;

  private readonly emailRequestTimestamps = new Map<string, number[]>();
  private readonly ipRequestTimestamps = new Map<string, number[]>();
  private readonly emailCooldownUntil = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailChannel: EmailChannelService,
  ) {
    this.otpExpiryMinutes = this.parsePositiveInt(
      this.configService.get<string>('PASSWORD_RESET_OTP_EXPIRY_MINUTES'),
      PASSWORD_RESET_DEFAULT_EXPIRY_MINUTES,
    );
    this.maxAttempts = this.parsePositiveInt(
      this.configService.get<string>('PASSWORD_RESET_MAX_ATTEMPTS'),
      PASSWORD_RESET_DEFAULT_MAX_ATTEMPTS,
    );
    this.resendCooldownSeconds = this.parsePositiveInt(
      this.configService.get<string>('PASSWORD_RESET_RESEND_COOLDOWN_SECONDS'),
      PASSWORD_RESET_DEFAULT_RESEND_COOLDOWN_SECONDS,
    );
    this.otpSecret =
      this.configService.get<string>('PASSWORD_RESET_OTP_SECRET')?.trim() ||
      this.configService.get<string>('JWT_SECRET')?.trim() ||
      'clinicqueue-dev-secret-key-change-in-production';
  }

  async requestReset(rawEmail: string, clientIp: string) {
    await this.cleanupExpiredRecords();

    const normalizedEmail = rawEmail.trim().toLowerCase();
    const emailKey = hashOtpOrToken(normalizedEmail, this.otpSecret);
    const ipKey = hashOtpOrToken(clientIp || 'unknown', this.otpSecret);
    const nowMs = Date.now();

    this.enforceResendCooldown(emailKey, nowMs);
    this.enforceSlidingWindowLimit(
      this.ipRequestTimestamps,
      ipKey,
      PASSWORD_RESET_MAX_REQUESTS_PER_IP,
      nowMs,
      'Too many password reset requests. Please try again later.',
    );
    this.enforceSlidingWindowLimit(
      this.emailRequestTimestamps,
      emailKey,
      PASSWORD_RESET_MAX_REQUESTS_PER_EMAIL,
      nowMs,
      'Too many password reset requests for this email. Please try again later.',
    );

    this.recordRequestTimestamp(this.ipRequestTimestamps, ipKey, nowMs);
    this.recordRequestTimestamp(this.emailRequestTimestamps, emailKey, nowMs);
    this.emailCooldownUntil.set(
      emailKey,
      nowMs + this.resendCooldownSeconds * MILLISECONDS_PER_SECOND,
    );

    const user = await this.findActiveUserByEmail(normalizedEmail);
    if (!user) {
      return successResponse(GENERIC_OTP_SENT_MESSAGE, {
        cooldownSeconds: this.resendCooldownSeconds,
      });
    }

    const now = new Date(nowMs);
    const expiresAt = new Date(
      nowMs + this.otpExpiryMinutes * MILLISECONDS_PER_MINUTE,
    );
    const otpCode = generateNumericOtp();
    const otpHash = hashOtpOrToken(otpCode, this.otpSecret);

    const createdRecord = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetOtp.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });

      return tx.passwordResetOtp.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt,
        },
        select: { id: true },
      });
    });

    const emailTemplate = buildPasswordResetOtpEmail(
      otpCode,
      this.otpExpiryMinutes,
    );
    const sent = await this.emailChannel.send({
      to: user.email,
      recipientName: user.fullName,
      type: NotificationType.GENERAL,
      title: emailTemplate.title,
      message: emailTemplate.message,
    });

    if (!sent) {
      await this.prisma.passwordResetOtp.delete({
        where: { id: createdRecord.id },
      });
      this.emailCooldownUntil.delete(emailKey);
      throw new ServiceUnavailableException(
        'Unable to send verification code right now. Please try again.',
      );
    }

    return successResponse(GENERIC_OTP_SENT_MESSAGE, {
      cooldownSeconds: this.resendCooldownSeconds,
    });
  }

  async verifyOtp(rawEmail: string, otp: string) {
    await this.cleanupExpiredRecords();

    const normalizedEmail = rawEmail.trim().toLowerCase();
    const user = await this.findActiveUserByEmail(normalizedEmail);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    const now = new Date();
    const activeOtp = await this.prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeOtp) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    if (activeOtp.attempts >= this.maxAttempts) {
      await this.prisma.passwordResetOtp.update({
        where: { id: activeOtp.id },
        data: { usedAt: now },
      });
      throw new BadRequestException(
        'Too many invalid attempts. Please request a new verification code.',
      );
    }

    const isMatch = verifyOtpOrTokenHash(
      otp,
      activeOtp.otpHash,
      this.otpSecret,
    );

    if (!isMatch) {
      const nextAttempts = activeOtp.attempts + 1;
      const exhausted = nextAttempts >= this.maxAttempts;
      await this.prisma.passwordResetOtp.update({
        where: { id: activeOtp.id },
        data: {
          attempts: nextAttempts,
          ...(exhausted ? { usedAt: now } : {}),
        },
      });

      if (exhausted) {
        throw new BadRequestException(
          'Too many invalid attempts. Please request a new verification code.',
        );
      }

      throw new BadRequestException('Invalid or expired verification code.');
    }

    const resetToken = generateResetProofToken();
    const resetTokenHash = hashOtpOrToken(resetToken, this.otpSecret);
    const resetTokenExpiresAt = new Date(
      now.getTime() +
        PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * MILLISECONDS_PER_MINUTE,
    );

    await this.prisma.passwordResetOtp.update({
      where: { id: activeOtp.id },
      data: {
        usedAt: now,
        resetTokenHash,
        resetTokenExpiresAt,
      },
    });

    return successResponse('Verification code confirmed.', {
      resetToken,
    });
  }

  async resetPassword(
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    await this.cleanupExpiredRecords();

    const now = new Date();
    const resetTokenHash = hashOtpOrToken(resetToken, this.otpSecret);

    const record = await this.prisma.passwordResetOtp.findFirst({
      where: {
        resetTokenHash,
        usedAt: { not: null },
        resetTokenExpiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'Reset session is invalid or has expired. Please start over.',
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
        },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: {
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      }),
      this.prisma.passwordResetOtp.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    return successResponse(
      'Password reset successful. You can now sign in with your new password.',
      {},
    );
  }

  private async findActiveUserByEmail(normalizedEmail: string) {
    return this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        isActive: true,
      },
      select: { id: true, email: true, fullName: true },
    });
  }

  private async cleanupExpiredRecords(): Promise<void> {
    const now = new Date();
    await this.prisma.passwordResetOtp.deleteMany({
      where: {
        expiresAt: { lte: now },
        OR: [
          { resetTokenExpiresAt: null },
          { resetTokenExpiresAt: { lte: now } },
        ],
      },
    });
  }

  private enforceResendCooldown(emailKey: string, nowMs: number): void {
    const cooldownUntil = this.emailCooldownUntil.get(emailKey);
    if (cooldownUntil && cooldownUntil > nowMs) {
      const remainingSeconds = Math.ceil(
        (cooldownUntil - nowMs) / MILLISECONDS_PER_SECOND,
      );
      throw new HttpException(
        `Please wait ${remainingSeconds} seconds before requesting another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private enforceSlidingWindowLimit(
    store: Map<string, number[]>,
    key: string,
    maxRequests: number,
    nowMs: number,
    message: string,
  ): void {
    const windowStart = nowMs - PASSWORD_RESET_RATE_LIMIT_WINDOW_MS;
    const recent = (store.get(key) ?? []).filter((ts) => ts > windowStart);
    store.set(key, recent);

    if (recent.length >= maxRequests) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordRequestTimestamp(
    store: Map<string, number[]>,
    key: string,
    nowMs: number,
  ): void {
    const windowStart = nowMs - PASSWORD_RESET_RATE_LIMIT_WINDOW_MS;
    const recent = (store.get(key) ?? []).filter((ts) => ts > windowStart);
    recent.push(nowMs);
    store.set(key, recent);
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    if (!raw) {
      return fallback;
    }
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}

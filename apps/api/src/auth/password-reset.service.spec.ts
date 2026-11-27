import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordResetService } from './password-reset.service';
import { EmailChannelService } from '../notifications/channels/email-channel.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashOtpOrToken } from './otp.util';

describe('PasswordResetService', () => {
  const secret = 'unit-test-secret';

  let mockPrisma: {
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    passwordResetOtp: {
      deleteMany: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let mockConfig: ConfigService;
  let mockEmailChannel: { send: jest.Mock };
  let service: PasswordResetService;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      passwordResetOtp: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 10 }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(
            mockPrisma,
          );
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          PASSWORD_RESET_OTP_EXPIRY_MINUTES: '5',
          PASSWORD_RESET_MAX_ATTEMPTS: '5',
          PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: '60',
          PASSWORD_RESET_OTP_SECRET: secret,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    mockEmailChannel = {
      send: jest.fn().mockResolvedValue(true),
    };

    service = new PasswordResetService(
      mockPrisma as unknown as PrismaService,
      mockConfig,
      mockEmailChannel as unknown as EmailChannelService,
    );
  });

  it('returns generic response without sending email for unregistered email addresses', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await service.requestReset('unknown@dlsud.edu.ph', '127.0.0.1');

    expect(res).toEqual({
      message:
        'If this email is registered, a verification code has been sent.',
      cooldownSeconds: 60,
    });
    expect(mockEmailChannel.send).not.toHaveBeenCalled();
    expect(mockPrisma.passwordResetOtp.create).not.toHaveBeenCalled();
  });

  it('creates hashed OTP, invalidates older OTPs, and sends email for registered user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 42,
      email: 'student@dlsud.edu.ph',
      fullName: 'Juan Dela Cruz',
    });

    const res = await service.requestReset('Student@dlsud.edu.ph', '127.0.0.1');

    expect(res.message).toBe(
      'If this email is registered, a verification code has been sent.',
    );
    expect(mockPrisma.passwordResetOtp.updateMany).toHaveBeenCalledTimes(1);
    const updateManyArg = (
      mockPrisma.passwordResetOtp.updateMany.mock.calls as Array<
        [{ where: { userId: number; usedAt: null }; data: { usedAt: Date } }]
      >
    )[0][0];
    expect(updateManyArg.where).toEqual({ userId: 42, usedAt: null });
    expect(updateManyArg.data.usedAt).toBeInstanceOf(Date);
    expect(mockPrisma.passwordResetOtp.create).toHaveBeenCalledTimes(1);
    const firstCreateArg = (
      mockPrisma.passwordResetOtp.create.mock.calls as Array<
        [{ data: { otpHash: string; userId: number } }]
      >
    )[0][0];
    expect(firstCreateArg.data.userId).toBe(42);
    expect(firstCreateArg.data.otpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(mockEmailChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student@dlsud.edu.ph',
        recipientName: 'Juan Dela Cruz',
        title: 'Password Reset Verification Code',
      }),
    );
  });

  it('enforces resend cooldown on repeated requests for the same email', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await service.requestReset('student@dlsud.edu.ph', '127.0.0.1');

    await expect(
      service.requestReset('student@dlsud.edu.ph', '127.0.0.1'),
    ).rejects.toThrow(HttpException);

    try {
      await service.requestReset('student@dlsud.edu.ph', '127.0.0.1');
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('cleans up created OTP and throws ServiceUnavailableException when email sending fails', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 42,
      email: 'student@dlsud.edu.ph',
      fullName: 'Juan Dela Cruz',
    });
    mockEmailChannel.send.mockResolvedValue(false);

    await expect(
      service.requestReset('student@dlsud.edu.ph', '127.0.0.1'),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(mockPrisma.passwordResetOtp.delete).toHaveBeenCalledWith({
      where: { id: 10 },
    });
  });

  it('increments attempts and invalidates OTP after max failed verifications', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 42,
      email: 'student@dlsud.edu.ph',
      fullName: 'Juan Dela Cruz',
    });
    mockPrisma.passwordResetOtp.findFirst.mockResolvedValue({
      id: 99,
      userId: 42,
      otpHash: hashOtpOrToken('654321', secret),
      attempts: 4,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    await expect(
      service.verifyOtp('student@dlsud.edu.ph', '000000'),
    ).rejects.toThrow(BadRequestException);

    const updateArg = (
      mockPrisma.passwordResetOtp.update.mock.calls as Array<
        [{ where: { id: number }; data: { attempts: number; usedAt: Date } }]
      >
    )[0][0];
    expect(updateArg.where).toEqual({ id: 99 });
    expect(updateArg.data.attempts).toBe(5);
    expect(updateArg.data.usedAt).toBeInstanceOf(Date);
  });

  it('verifies valid OTP and issues a single-use resetToken', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 42,
      email: 'student@dlsud.edu.ph',
      fullName: 'Juan Dela Cruz',
    });
    mockPrisma.passwordResetOtp.findFirst.mockResolvedValue({
      id: 99,
      userId: 42,
      otpHash: hashOtpOrToken('123456', secret),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    const res = await service.verifyOtp('student@dlsud.edu.ph', '123456');

    expect(res.resetToken).toMatch(/^[a-f0-9]{64}$/);
    const updateArg = (
      mockPrisma.passwordResetOtp.update.mock.calls as Array<
        [
          {
            where: { id: number };
            data: {
              usedAt: Date;
              resetTokenHash: string;
              resetTokenExpiresAt: Date;
            };
          },
        ]
      >
    )[0][0];
    expect(updateArg.where).toEqual({ id: 99 });
    expect(updateArg.data.usedAt).toBeInstanceOf(Date);
    expect(updateArg.data.resetTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(updateArg.data.resetTokenExpiresAt).toBeInstanceOf(Date);
  });

  it('resets password with valid resetToken and invalidates existing sessions', async () => {
    const resetToken = 'a'.repeat(64);
    mockPrisma.passwordResetOtp.findFirst.mockResolvedValue({
      id: 99,
      userId: 42,
    });

    const res = await service.resetPassword(
      resetToken,
      'NewPassword123!',
      'NewPassword123!',
    );

    expect(res.message).toContain('Password reset successful');
    const userUpdateArg = (
      mockPrisma.user.update.mock.calls as Array<
        [
          {
            where: { id: number };
            data: { passwordHash: string; passwordChangedAt: Date };
          },
        ]
      >
    )[0][0];
    expect(userUpdateArg.where).toEqual({ id: 42 });
    expect(userUpdateArg.data.passwordHash).toContain('$argon2');
    expect(userUpdateArg.data.passwordChangedAt).toBeInstanceOf(Date);
    expect(mockPrisma.passwordResetOtp.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: {
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });
  });

  it('rejects resetPassword when passwords do not match', async () => {
    await expect(
      service.resetPassword('a'.repeat(64), 'Password1!', 'Password2!'),
    ).rejects.toThrow(BadRequestException);
  });
});

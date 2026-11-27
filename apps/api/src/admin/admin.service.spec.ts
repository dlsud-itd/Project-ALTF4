import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, ClinicAffiliation } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    appointment: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    queueEntry: {
      count: jest.Mock;
    };
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      appointment: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      queueEntry: {
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return mapped users with counts', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 1,
          fullName: 'Test User',
          email: 'test@example.com',
          role: AccessRole.STAFF,
          affiliation: ClinicAffiliation.STAFF,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { appointments: 2, queueEntries: 5 },
        },
      ]);

      const res = await service.getUsers();
      expect(res.users).toHaveLength(1);
      expect(res.users[0].appointmentCount).toBe(2);
      expect(res.users[0].queueCount).toBe(5);
    });
  });

  describe('createUser', () => {
    it('should throw ConflictException if email exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'dup@example.com',
      });

      await expect(
        service.createUser(99, {
          fullName: 'Dup',
          email: 'dup@example.com',
          phoneNumber: '+639171234567',
          password: 'Password123!',
          role: AccessRole.PATIENT,
          affiliation: ClinicAffiliation.STUDENT,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateUser', () => {
    it('should prevent admin from deactivating self', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 99,
        role: AccessRole.ADMIN,
        isActive: true,
      });

      await expect(
        service.updateUser(99, 99, { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent admin from demoting self', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 99,
        role: AccessRole.ADMIN,
        isActive: true,
      });

      await expect(
        service.updateUser(99, 99, { role: AccessRole.PATIENT }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteUser', () => {
    it('should prevent admin from deactivating self', async () => {
      await expect(service.deleteUser(99, 99)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should soft delete user by setting isActive to false', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 10,
        fullName: 'Target User',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 10,
        fullName: 'Target User',
        isActive: false,
      });

      const res = await service.deleteUser(99, 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { isActive: false },
        select: expect.any(Object),
      });
      expect(res.message).toContain('deactivated');
    });
  });
});

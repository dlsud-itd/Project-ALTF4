import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, QueueStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCreateUserDto } from './dto/create-user.dto';
import { AdminUpdateUserDto } from './dto/update-user.dto';
import { successResponse } from '../common/api-response';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        affiliation: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            appointments: true,
            queueEntries: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        affiliation: u.affiliation,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        appointmentCount: u._count.appointments,
        queueCount: u._count.queueEntries,
      })),
    };
  }

  async createUser(adminId: number, dto: AdminCreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        role: dto.role,
        affiliation: dto.affiliation,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        affiliation: true,
        isActive: true,
        createdAt: true,
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_USER_CREATED',
          entityTable: 'app_user',
          entityId: user.id,
          description: `Admin created user ${user.fullName} (${user.email}) with role ${user.role}`,
          newValues: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            affiliation: user.affiliation,
          },
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return successResponse('User created successfully', { user });
  }

  async updateUser(
    adminId: number,
    targetUserId: number,
    dto: AdminUpdateUserDto,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    // Safety constraint: Prevent admin from deactivating or demoting themselves
    if (adminId === targetUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException(
          'Cannot deactivate your own administrator account',
        );
      }
      if (dto.role && dto.role !== AccessRole.ADMIN) {
        throw new BadRequestException(
          'Cannot remove admin role from your own account',
        );
      }
    }

    if (dto.email && dto.email !== existing.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailConflict) {
        throw new ConflictException('Email is already registered to another user');
      }
    }

    const dataToUpdate: Record<string, unknown> = {};
    if (dto.fullName !== undefined) dataToUpdate['fullName'] = dto.fullName;
    if (dto.email !== undefined) dataToUpdate['email'] = dto.email;
    if (dto.role !== undefined) dataToUpdate['role'] = dto.role;
    if (dto.affiliation !== undefined) dataToUpdate['affiliation'] = dto.affiliation;
    if (dto.isActive !== undefined) dataToUpdate['isActive'] = dto.isActive;

    if (dto.password) {
      dataToUpdate['passwordHash'] = await argon2.hash(dto.password);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: dataToUpdate,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        affiliation: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_USER_UPDATED',
          entityTable: 'app_user',
          entityId: targetUserId,
          description: `Admin updated user ${updated.fullName} (ID: ${targetUserId})`,
          oldValues: {
            fullName: existing.fullName,
            email: existing.email,
            role: existing.role,
            affiliation: existing.affiliation,
            isActive: existing.isActive,
          },
          newValues: {
            fullName: updated.fullName,
            email: updated.email,
            role: updated.role,
            affiliation: updated.affiliation,
            isActive: updated.isActive,
          },
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return successResponse('User updated successfully', { user: updated });
  }

  async deleteUser(adminId: number, targetUserId: number) {
    if (adminId === targetUserId) {
      throw new BadRequestException(
        'Cannot deactivate your own administrator account',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const deactivated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
      select: { id: true, fullName: true, email: true, isActive: true },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_USER_DEACTIVATED',
          entityTable: 'app_user',
          entityId: targetUserId,
          description: `Admin deactivated user account for ${existing.fullName}`,
          oldValues: { isActive: existing.isActive },
          newValues: { isActive: false },
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return successResponse('User account deactivated successfully', {
      user: deactivated,
    });
  }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalUsers,
      totalPatients,
      totalStaff,
      totalAdmins,
      totalAppointments,
      todayAppointments,
      waitingQueueEntries,
      inConsultationEntries,
      auditLogsCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: AccessRole.PATIENT } }),
      this.prisma.user.count({ where: { role: AccessRole.STAFF } }),
      this.prisma.user.count({ where: { role: AccessRole.ADMIN } }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({
        where: {
          slot: {
            clinicDate: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
      }),
      this.prisma.queueEntry.count({
        where: { status: QueueStatus.WAITING },
      }),
      this.prisma.queueEntry.count({
        where: { status: QueueStatus.IN_CONSULTATION },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      stats: {
        totalUsers,
        totalPatients,
        totalStaff,
        totalAdmins,
        totalAppointments,
        todayAppointments,
        waitingQueueCount: waitingQueueEntries,
        inConsultationCount: inConsultationEntries,
        totalAuditLogs: auditLogsCount,
      },
    };
  }

  async getAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });

    return {
      auditLogs: logs.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actor: log.actor
          ? {
              id: log.actor.id,
              fullName: log.actor.fullName,
              email: log.actor.email,
              role: log.actor.role,
            }
          : null,
        action: log.action,
        entityTable: log.entityTable,
        entityId: log.entityId,
        description: log.description,
        oldValues: log.oldValues,
        newValues: log.newValues,
        occurredAt: log.occurredAt,
      })),
    };
  }

  async getAppointments() {
    const appointments = await this.prisma.appointment.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            fullName: true,
            email: true,
            affiliation: true,
          },
        },
        slot: {
          select: {
            id: true,
            clinicDate: true,
            startTime: true,
            endTime: true,
            capacity: true,
            isBookable: true,
          },
        },
        queueEntries: {
          take: 1,
          orderBy: { queueNumber: 'desc' },
          select: {
            ticketNumber: true,
            status: true,
            reasonForVisit: true,
          },
        },
      },
      orderBy: [
        { slot: { clinicDate: 'desc' } },
        { slot: { startTime: 'desc' } },
      ],
    });

    return {
      appointments: appointments.map((appt) => ({
        id: appt.id,
        status: appt.status,
        createdAt: appt.createdAt,
        patient: appt.patient,
        slot: {
          id: appt.slot.id,
          clinicDate: appt.slot.clinicDate.toISOString().slice(0, 10),
          startTime: appt.slot.startTime,
          endTime: appt.slot.endTime,
          capacity: appt.slot.capacity,
          isBookable: appt.slot.isBookable,
        },
        ticketNumber: appt.queueEntries[0]?.ticketNumber ?? null,
        reasonForVisit: appt.queueEntries[0]?.reasonForVisit ?? null,
      })),
    };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma, QueueStatus } from '@prisma/client';
import { APPOINTMENT_STATUS_TRANSITIONS } from '../appointments/appointment-status';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_STATUS_TRANSITIONS } from './queue-status';

const APPOINTMENT_STATUS_BY_QUEUE_STATUS: Partial<
  Record<QueueStatus, AppointmentStatus>
> = {
  [QueueStatus.COMPLETED]: AppointmentStatus.COMPLETED,
  [QueueStatus.NO_SHOW]: AppointmentStatus.NO_SHOW,
  [QueueStatus.CANCELLED]: AppointmentStatus.CANCELLED,
};

type TransitionEntryOptions = {
  queueId: number;
  entryId: number;
  requestedStatus: QueueStatus;
  now: Date;
  notes?: string;
  ignoreConcurrentChange?: boolean;
  synchronizeAppointment?: boolean;
};

type CancelledQueueEntry = {
  id: number;
  dailyQueueId: number;
  ticketNumber: string;
  status: QueueStatus;
};

@Injectable()
export class QueueLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async transitionEntry(
    tx: Prisma.TransactionClient,
    options: TransitionEntryOptions,
  ) {
    const entry = await tx.queueEntry.findFirst({
      where: {
        id: options.entryId,
        dailyQueueId: options.queueId,
      },
      select: {
        id: true,
        status: true,
        notes: true,
        appointmentId: true,
      },
    });

    if (!entry) {
      if (options.ignoreConcurrentChange) {
        return null;
      }
      throw new NotFoundException({
        code: 'ENTRY_NOT_FOUND',
        message: 'Queue entry not found.',
      });
    }

    if (
      !QUEUE_STATUS_TRANSITIONS[entry.status].includes(options.requestedStatus)
    ) {
      throw this.invalidQueueTransition(entry.status, options.requestedStatus);
    }

    const cleanedNotes = options.notes?.replace(/<[^>]*>/g, '').trim();
    const appendedNotes = cleanedNotes
      ? `${entry.notes?.trim() ? `${entry.notes.trim()}\n` : ''}[${options.now.toISOString()}] ${cleanedNotes}`
      : undefined;
    const updateData: Prisma.QueueEntryUpdateManyMutationInput = {
      status: options.requestedStatus,
      ...(options.requestedStatus === QueueStatus.IN_CONSULTATION
        ? { consultationStartedAt: options.now, graceExpiresAt: null }
        : {}),
      ...(options.requestedStatus === QueueStatus.COMPLETED
        ? { completedAt: options.now }
        : {}),
      ...(options.requestedStatus === QueueStatus.NO_SHOW
        ? { noShowAt: options.now, graceExpiresAt: null }
        : {}),
      ...(options.requestedStatus === QueueStatus.CANCELLED
        ? { cancelledAt: options.now, graceExpiresAt: null }
        : {}),
      ...(appendedNotes ? { notes: appendedNotes } : {}),
    };

    const changed = await tx.queueEntry.updateMany({
      where: {
        id: entry.id,
        dailyQueueId: options.queueId,
        status: entry.status,
      },
      data: updateData,
    });

    if (changed.count !== 1) {
      if (options.ignoreConcurrentChange) {
        return null;
      }
      const latest = await tx.queueEntry.findFirst({
        where: { id: options.entryId, dailyQueueId: options.queueId },
        select: { status: true },
      });
      if (!latest) {
        throw new NotFoundException({
          code: 'ENTRY_NOT_FOUND',
          message: 'Queue entry not found.',
        });
      }
      throw this.invalidQueueTransition(latest.status, options.requestedStatus);
    }

    const appointmentStatus =
      APPOINTMENT_STATUS_BY_QUEUE_STATUS[options.requestedStatus];
    if (
      options.synchronizeAppointment !== false &&
      entry.appointmentId &&
      appointmentStatus
    ) {
      const appointment = await tx.appointment.findUnique({
        where: { id: entry.appointmentId },
        select: { status: true },
      });
      if (!appointment) {
        throw new NotFoundException({
          code: 'APPOINTMENT_NOT_FOUND',
          message: 'The queue entry appointment was not found.',
        });
      }
      if (
        !APPOINTMENT_STATUS_TRANSITIONS[appointment.status].includes(
          appointmentStatus,
        )
      ) {
        throw this.invalidAppointmentTransition(
          appointment.status,
          appointmentStatus,
        );
      }
      const appointmentChanged = await tx.appointment.updateMany({
        where: {
          id: entry.appointmentId,
          status: appointment.status,
        },
        data: { status: appointmentStatus },
      });
      if (appointmentChanged.count !== 1) {
        throw this.invalidAppointmentTransition(
          appointment.status,
          appointmentStatus,
        );
      }
    }

    const updated = await tx.queueEntry.findUnique({
      where: { id: entry.id },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        updatedAt: true,
        notes: true,
        calledAt: true,
        graceExpiresAt: true,
        consultationStartedAt: true,
        completedAt: true,
        noShowAt: true,
        cancelledAt: true,
      },
    });
    if (!updated) {
      throw new NotFoundException({
        code: 'ENTRY_NOT_FOUND',
        message: 'Queue entry not found.',
      });
    }

    await tx.queueStatusHistory.create({
      data: { queueEntryId: updated.id, status: options.requestedStatus },
    });
    return updated;
  }

  async cancelAppointment(
    appointmentId: number,
    now = new Date(),
  ): Promise<CancelledQueueEntry[]> {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, status: true },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }
      if (
        !APPOINTMENT_STATUS_TRANSITIONS[appointment.status].includes(
          AppointmentStatus.CANCELLED,
        )
      ) {
        throw this.invalidAppointmentTransition(
          appointment.status,
          AppointmentStatus.CANCELLED,
        );
      }

      const cancelled = await tx.appointment.updateMany({
        where: { id: appointmentId, status: appointment.status },
        data: { status: AppointmentStatus.CANCELLED },
      });
      if (cancelled.count !== 1) {
        throw this.invalidAppointmentTransition(
          appointment.status,
          AppointmentStatus.CANCELLED,
        );
      }

      const activeEntries = await tx.queueEntry.findMany({
        where: {
          appointmentId,
          status: {
            in: [
              QueueStatus.WAITING,
              QueueStatus.CALLED,
              QueueStatus.IN_CONSULTATION,
            ],
          },
        },
        select: {
          id: true,
          dailyQueueId: true,
          ticketNumber: true,
          status: true,
        },
      });
      const cancelledEntries: CancelledQueueEntry[] = [];
      for (const entry of activeEntries) {
        const updated = await this.transitionEntry(tx, {
          queueId: entry.dailyQueueId,
          entryId: entry.id,
          requestedStatus: QueueStatus.CANCELLED,
          now,
          ignoreConcurrentChange: true,
          synchronizeAppointment: false,
        });
        if (updated) {
          cancelledEntries.push({
            id: updated.id,
            dailyQueueId: entry.dailyQueueId,
            ticketNumber: entry.ticketNumber,
            status: updated.status,
          });
        }
      }
      return cancelledEntries;
    });
  }

  private invalidQueueTransition(
    currentStatus: QueueStatus,
    requestedStatus: QueueStatus,
  ) {
    return new ConflictException({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition from ${currentStatus} to ${requestedStatus}.`,
      currentStatus,
      requestedStatus,
      allowedNextStatuses: QUEUE_STATUS_TRANSITIONS[currentStatus],
    });
  }

  private invalidAppointmentTransition(
    currentStatus: AppointmentStatus,
    requestedStatus: AppointmentStatus,
  ) {
    return new ConflictException({
      code: 'INVALID_APPOINTMENT_TRANSITION',
      message: `Cannot transition appointment from ${currentStatus} to ${requestedStatus}.`,
      currentStatus,
      requestedStatus,
      allowedNextStatuses: APPOINTMENT_STATUS_TRANSITIONS[currentStatus],
    });
  }
}

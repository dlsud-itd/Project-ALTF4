import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QueueSource, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CallNextDto } from './dto/call-next.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';
import { WalkInDto } from './dto/walk-in.dto';
import { QueueEventsService } from './queue-events.service';
import {
  ACTIVE_QUEUE_STATUSES,
  GRACE_PERIOD_MS,
  QueueReadService,
} from './queue-read.service';
import { QueueLifecycleService } from './queue-lifecycle.service';

@Injectable()
export class QueueService {
  private readonly activeStatuses = [...ACTIVE_QUEUE_STATUSES];

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: QueueEventsService,
    private readonly queueRead: QueueReadService,
    private readonly lifecycle: QueueLifecycleService,
  ) {}

  getQueueEvents(queueId: number) {
    return this.events.getQueueEvents(queueId);
  }

  private async ensureQueueOpen(queueId: number) {
    const queue = await this.queueRead.getQueueOrThrow(queueId);
    if (!queue.isOpen) {
      throw new ConflictException({
        code: 'QUEUE_CLOSED',
        message:
          'The specified queue session is no longer accepting new queue entries.',
      });
    }
    return queue;
  }

  private async ensureNoDuplicateActiveEntry(
    queueId: number,
    patientId?: number | null,
  ) {
    if (!patientId) {
      return;
    }

    const existing = await this.prisma.queueEntry.findFirst({
      where: {
        dailyQueueId: queueId,
        patientId,
        status: { in: this.activeStatuses },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ACTIVE_ENTRY',
        message:
          'This patient already has an active queue entry in this session.',
      });
    }
  }

  private async createQueueEntry(
    queueId: number,
    dto: WalkInDto,
    source: QueueSource,
  ) {
    await this.ensureQueueOpen(queueId);
    await this.ensureNoDuplicateActiveEntry(queueId, dto.patientId);

    try {
      const { createdEntry, ticketNumber, rawTrackingToken, queueSession } =
        await this.prisma.$transaction(
          async (tx) => {
            const queueSession = await tx.dailyQueue.findUnique({
              where: { id: queueId },
            });

            if (!queueSession) {
              throw new NotFoundException({
                code: 'QUEUE_NOT_FOUND',
                message: 'The target queue session was not found.',
              });
            }

            if (!queueSession.isOpen) {
              throw new ConflictException({
                code: 'QUEUE_CLOSED',
                message:
                  'The specified queue session is no longer accepting new queue entries.',
              });
            }

            if (dto.patientId) {
              const existing = await tx.queueEntry.findFirst({
                where: {
                  dailyQueueId: queueId,
                  patientId: dto.patientId,
                  status: { in: this.activeStatuses },
                },
                select: { id: true },
              });

              if (existing) {
                throw new ConflictException({
                  code: 'DUPLICATE_ACTIVE_ENTRY',
                  message:
                    'This patient already has an active queue entry in this session.',
                });
              }
            }

            const allocatedQueue = await tx.dailyQueue.update({
              where: { id: queueId },
              data: { nextNumber: { increment: 1 } },
            });
            const latestEntry = await tx.queueEntry.findFirst({
              where: { dailyQueueId: queueId },
              orderBy: { queueNumber: 'desc' },
              select: { queueNumber: true },
            });
            const nextNumber = Math.max(
              allocatedQueue.nextNumber - 1,
              (latestEntry?.queueNumber ?? 0) + 1,
            );
            if (nextNumber >= allocatedQueue.nextNumber) {
              await tx.dailyQueue.update({
                where: { id: queueId },
                data: { nextNumber: nextNumber + 1 },
              });
            }
            const ticketNumber = `A-${String(nextNumber).padStart(3, '0')}`;
            const rawTrackingToken = `trk_${randomBytes(8).toString('hex')}`;
            const trackingTokenHash =
              this.queueRead.hashTrackingToken(rawTrackingToken);

            const createdEntry = await tx.queueEntry.create({
              data: {
                dailyQueueId: queueId,
                patientId: dto.patientId ?? null,
                queueNumber: nextNumber,
                ticketNumber,
                source,
                status: QueueStatus.WAITING,
                trackingToken: trackingTokenHash,
                firstName: dto.name,
                reasonForVisit: dto.reasonForVisit,
              },
              select: {
                id: true,
                createdAt: true,
                status: true,
                ticketNumber: true,
              },
            });

            await this.queueRead.recordStatusHistory(
              tx,
              createdEntry.id,
              QueueStatus.WAITING,
            );

            return {
              createdEntry,
              ticketNumber,
              rawTrackingToken,
              queueSession,
            };
          },
          { maxWait: 5000, timeout: 15000 },
        );

      const { position, estimatedWaitMinutes } =
        await this.queueRead.getQueuePositionAndWait(
          queueId,
          queueSession,
          createdEntry.id,
        );

      this.events.emit(queueId, 'queue:updated', {
        queueId,
        queueEntryId: createdEntry.id,
        ticketNumber,
        status: QueueStatus.WAITING,
        source,
        positionInQueue: position,
        estimatedWaitMinutes,
        timestamp: createdEntry.createdAt.toISOString(),
      });

      return {
        queue_entry_id: createdEntry.id,
        queue_id: queueId,
        ticket_number: ticketNumber,
        position_in_queue: position,
        estimated_wait_minutes: estimatedWaitMinutes,
        status: createdEntry.status,
        tracking_token: rawTrackingToken,
        joined_at: createdEntry.createdAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_ACTIVE_ENTRY',
          message:
            'This patient already has an active queue entry in this session.',
        });
      }
      throw error;
    }
  }

  async joinOnline(queueId: number, dto: WalkInDto) {
    // A patient must have an active booked appointment to join the online queue
    if (dto.patientId && this.prisma.appointment?.findFirst) {
      const activeAppointment = await this.prisma.appointment.findFirst({
        where: {
          patientId: dto.patientId,
          status: 'BOOKED',
        },
      });

      if (!activeAppointment) {
        throw new BadRequestException({
          code: 'NO_ACTIVE_APPOINTMENT',
          message:
            'You must have a confirmed booked appointment to join the queue.',
        });
      }
    }

    return this.createQueueEntry(queueId, dto, QueueSource.ONLINE);
  }

  async joinWalkIn(queueId: number, dto: WalkInDto) {
    return this.createQueueEntry(queueId, dto, QueueSource.WALK_IN);
  }

  async joinStaffGenerated(queueId: number, dto: WalkInDto) {
    return this.createQueueEntry(queueId, dto, QueueSource.STAFF_GENERATED);
  }

  async getQueueStatus(queueId: number) {
    return this.queueRead.getQueueStatus(queueId);
  }

  async getStaffQueueStatus(queueId: number) {
    return this.queueRead.getQueueStatus(queueId, true);
  }

  async callNext(queueId: number, dto: CallNextDto) {
    await this.queueRead.getQueueOrThrow(queueId);
    const calledAt = new Date();
    const room = typeof dto.room === 'string' ? dto.room.trim() : '';
    const provider =
      typeof dto.provider === 'string' ? dto.provider.trim() : '';
    const invalidFields = [
      ...(room.length === 0 || room.length > 60 ? ['room'] : []),
      ...(provider.length === 0 || provider.length > 60 ? ['provider'] : []),
    ];
    if (invalidFields.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Invalid fields: ${invalidFields.join(', ')}.`,
      });
    }
    await this.queueRead.expireCalledEntries(queueId, calledAt);

    const nextEntry = await this.prisma.queueEntry.findFirst({
      where: { dailyQueueId: queueId, status: QueueStatus.WAITING },
      orderBy: [{ createdAt: 'asc' }, { queueNumber: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    if (!nextEntry) {
      const activeCall = await this.prisma.queueEntry.findFirst({
        where: {
          dailyQueueId: queueId,
          status: {
            in: [QueueStatus.CALLED, QueueStatus.IN_CONSULTATION],
          },
        },
        select: { id: true },
      });
      if (activeCall) {
        throw new ConflictException({
          code: 'STATION_BUSY',
          message: 'A patient is already called or in consultation.',
        });
      }
      throw new ConflictException({
        code: 'QUEUE_EMPTY',
        message: 'No patients are waiting.',
      });
    }

    const graceExpiresAt = new Date(calledAt.getTime() + GRACE_PERIOD_MS);
    const updatedEntry = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.queueEntry.updateMany({
        where: {
          id: nextEntry.id,
          dailyQueueId: queueId,
          status: QueueStatus.WAITING,
        },
        data: {
          status: QueueStatus.CALLED,
          calledAt,
          graceExpiresAt,
          roomNumber: room,
          provider,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          code: 'ALREADY_CALLED',
          message: 'Another staff member already called the next patient.',
        });
      }

      const activeCall = await tx.queueEntry.findFirst({
        where: {
          dailyQueueId: queueId,
          id: { not: nextEntry.id },
          status: {
            in: [QueueStatus.CALLED, QueueStatus.IN_CONSULTATION],
          },
        },
        select: { id: true },
      });
      if (activeCall) {
        throw new ConflictException({
          code: 'STATION_BUSY',
          message: 'A patient is already called or in consultation.',
        });
      }

      const entry = await tx.queueEntry.findUnique({
        where: { id: nextEntry.id },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          firstName: true,
          lastName: true,
          reasonForVisit: true,
        },
      });
      if (!entry) {
        throw new NotFoundException({
          code: 'ENTRY_NOT_FOUND',
          message: 'Queue entry not found.',
        });
      }
      await this.queueRead.recordStatusHistory(
        tx,
        entry.id,
        QueueStatus.CALLED,
      );
      return entry;
    });

    const patientName =
      `${updatedEntry.firstName || ''} ${updatedEntry.lastName || ''}`.trim();

    this.events.emit(queueId, 'queue:called', {
      queueId,
      queueEntryId: updatedEntry.id,
      ticketNumber: updatedEntry.ticketNumber,
      roomNumber: room,
      provider,
      calledAt: calledAt.toISOString(),
      graceExpiresAt: graceExpiresAt.toISOString(),
    });

    return {
      queue_entry_id: updatedEntry.id,
      ticket_number: updatedEntry.ticketNumber,
      patient_name: patientName || null,
      reason_for_visit: updatedEntry.reasonForVisit || null,
      status: updatedEntry.status,
      called_at: calledAt.toISOString(),
      grace_expires_at: graceExpiresAt.toISOString(),
      grace_period_ms: GRACE_PERIOD_MS,
      room_number: room,
      provider,
    };
  }

  async recallCurrent(queueId: number) {
    await this.queueRead.getQueueOrThrow(queueId);
    await this.queueRead.expireCalledEntries(queueId);
    const currentEntry = await this.prisma.queueEntry.findFirst({
      where: { dailyQueueId: queueId, status: QueueStatus.CALLED },
      orderBy: { calledAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        roomNumber: true,
        calledAt: true,
      },
    });

    if (!currentEntry) {
      throw new ConflictException({
        code: 'NO_CALLED_PATIENT',
        message: 'There is no called patient to recall.',
      });
    }

    this.events.emit(queueId, 'queue:called', {
      queueId,
      queueEntryId: currentEntry.id,
      ticketNumber: currentEntry.ticketNumber,
      roomNumber: currentEntry.roomNumber || 'Counter 1',
      calledAt:
        currentEntry.calledAt?.toISOString() ?? new Date().toISOString(),
      recalled: true,
    });

    return {
      queue_entry_id: currentEntry.id,
      ticket_number: currentEntry.ticketNumber,
      status: QueueStatus.CALLED,
    };
  }

  async updateEntryStatus(
    queueId: number,
    entryId: number,
    dto: UpdateEntryStatusDto,
  ) {
    const now = new Date();
    await this.queueRead.expireCalledEntries(queueId, now);
    if (dto.status === QueueStatus.CALLED) {
      if (dto.notes !== undefined) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Notes are not allowed when status is CALLED.',
        });
      }
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Use call-next to transition a waiting entry to CALLED.',
      });
    }

    const updated = await this.prisma.$transaction((tx) =>
      this.lifecycle.transitionEntry(tx, {
        queueId,
        entryId,
        requestedStatus: dto.status,
        now,
        notes: dto.notes,
      }),
    );
    if (!updated) {
      throw new NotFoundException({
        code: 'ENTRY_NOT_FOUND',
        message: 'Queue entry not found.',
      });
    }

    const totalWaiting = await this.prisma.queueEntry.count({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.WAITING,
      },
    });

    this.events.emit(queueId, 'queue:updated', {
      queueId,
      queueEntryId: updated.id,
      ticketNumber: updated.ticketNumber,
      status: updated.status,
      totalWaiting,
      timestamp: updated.updatedAt.toISOString(),
      calledAt: updated.calledAt?.toISOString() ?? null,
      graceExpiresAt: updated.graceExpiresAt?.toISOString() ?? null,
      consultationStartedAt:
        updated.consultationStartedAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
      noShowAt: updated.noShowAt?.toISOString() ?? null,
      cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    });

    return {
      queue_entry_id: updated.id,
      queue_id: queueId,
      ticket_number: updated.ticketNumber,
      status: updated.status,
      updated_at: updated.updatedAt.toISOString(),
      notes: updated.notes,
      called_at: updated.calledAt?.toISOString() ?? null,
      grace_expires_at: updated.graceExpiresAt?.toISOString() ?? null,
      consultation_started_at:
        updated.consultationStartedAt?.toISOString() ?? null,
      completed_at: updated.completedAt?.toISOString() ?? null,
      no_show_at: updated.noShowAt?.toISOString() ?? null,
      cancelled_at: updated.cancelledAt?.toISOString() ?? null,
    };
  }

  async getTrackingStatus(trackingToken: string) {
    return this.queueRead.getTrackingStatus(trackingToken);
  }

  async getMyQueueEntry(queueId: number, patientId: number) {
    return this.queueRead.getMyQueueEntry(queueId, patientId);
  }
}

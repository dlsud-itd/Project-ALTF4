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
import { ACTIVE_QUEUE_STATUSES, QueueReadService } from './queue-read.service';

export const GRACE_PERIOD_SECONDS = 180;

@Injectable()
export class QueueService {
  private readonly activeStatuses = [...ACTIVE_QUEUE_STATUSES];

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: QueueEventsService,
    private readonly queueRead: QueueReadService,
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
            const nextNumber = allocatedQueue.nextNumber - 1;
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
                joinedAt: true,
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
        timestamp: createdEntry.joinedAt.toISOString(),
      });

      return {
        queue_entry_id: createdEntry.id,
        queue_id: queueId,
        ticket_number: ticketNumber,
        position_in_queue: position,
        estimated_wait_minutes: estimatedWaitMinutes,
        status: createdEntry.status,
        tracking_token: rawTrackingToken,
        joined_at: createdEntry.joinedAt.toISOString(),
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

  async callNext(queueId: number, dto: CallNextDto) {
    await this.queueRead.getQueueOrThrow(queueId);
    const callResult = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "daily_queue" WHERE "id" = ${queueId} FOR UPDATE`;
      const calledAt = new Date();
      await this.queueRead.expireCalledEntries(queueId, calledAt, tx);

      const activeCall = await tx.queueEntry.findFirst({
        where: { dailyQueueId: queueId, status: QueueStatus.CALLED },
        select: { id: true },
      });
      if (activeCall) {
        return { error: 'QUEUE_CALL_IN_PROGRESS' as const };
      }

      const nextEntry = await tx.queueEntry.findFirst({
        where: { dailyQueueId: queueId, status: QueueStatus.WAITING },
        orderBy: { queueNumber: 'asc' },
        select: { id: true },
      });
      if (!nextEntry) {
        return { error: 'QUEUE_EMPTY' as const };
      }

      const graceExpiresAt = new Date(
        calledAt.getTime() + GRACE_PERIOD_SECONDS * 1000,
      );
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
          roomNumber: dto.roomNumber,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          code: 'QUEUE_ENTRY_CHANGED',
          message:
            'The next waiting ticket changed; refresh the queue and try again.',
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
          calledAt: true,
          graceExpiresAt: true,
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
      return { entry, calledAt, graceExpiresAt };
    }, { maxWait: 5000, timeout: 15000 });

    if ('error' in callResult) {
      if (callResult.error === 'QUEUE_CALL_IN_PROGRESS') {
        throw new ConflictException({
          code: callResult.error,
          message:
            'The current called patient must arrive or time out before calling the next patient.',
        });
      }
      throw new BadRequestException({
        code: callResult.error,
        message: 'No waiting patients currently in the queue to call.',
      });
    }

    const updatedEntry = callResult.entry;
    const patientName =
      `${updatedEntry.firstName || ''} ${updatedEntry.lastName || ''}`.trim() ||
      'Patient';

    this.events.emit(queueId, 'queue:called', {
      queueId,
      queueEntryId: updatedEntry.id,
      ticketNumber: updatedEntry.ticketNumber,
      roomNumber: dto.roomNumber,
      calledAt: callResult.calledAt.toISOString(),
      graceExpiresAt: callResult.graceExpiresAt.toISOString(),
    });

    return {
      queue_entry_id: updatedEntry.id,
      ticket_number: updatedEntry.ticketNumber,
      patient_name: patientName,
      status: updatedEntry.status,
      called_at: callResult.calledAt.toISOString(),
      grace_expires_at: callResult.graceExpiresAt.toISOString(),
      room_number: dto.roomNumber,
    };
  }

  async updateEntryStatus(
    queueId: number,
    entryId: number,
    dto: UpdateEntryStatusDto,
  ) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        id: entryId,
        dailyQueueId: queueId,
      },
      select: { id: true },
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'ENTRY_NOT_FOUND',
        message: 'Queue entry not found.',
      });
    }

    if (
      dto.status !== QueueStatus.IN_SERVICE &&
      dto.status !== QueueStatus.DONE
    ) {
      throw new BadRequestException({
        code: 'INVALID_QUEUE_TRANSITION',
        message: 'Only arrival and completion transitions are accepted here.',
      });
    }

    const now = new Date();
    const updatedResult = await this.prisma.queueEntry.updateMany({
      where: {
        id: entryId,
        dailyQueueId: queueId,
        status:
          dto.status === QueueStatus.IN_SERVICE
            ? QueueStatus.CALLED
            : QueueStatus.IN_SERVICE,
        ...(dto.status === QueueStatus.IN_SERVICE
          ? { graceExpiresAt: { gt: now } }
          : {}),
      },
      data: {
        status: dto.status,
        ...(dto.status === QueueStatus.IN_SERVICE
          ? { graceExpiresAt: null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    if (updatedResult.count !== 1) {
      if (dto.status === QueueStatus.IN_SERVICE) {
        await this.queueRead.expireCalledEntries(queueId, now);
      }
      throw new ConflictException({
        code: 'INVALID_QUEUE_TRANSITION',
        message:
          dto.status === QueueStatus.IN_SERVICE
            ? 'The grace period has expired or this ticket is no longer waiting for arrival.'
            : 'Only an in-service patient can be marked done.',
      });
    }

    const updated = await this.prisma.queueEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        updatedAt: true,
        notes: true,
      },
    });
    if (!updated) {
      throw new NotFoundException({
        code: 'ENTRY_NOT_FOUND',
        message: 'Queue entry not found.',
      });
    }

    await this.queueRead.recordStatusHistory(
      this.prisma,
      updated.id,
      dto.status,
    );

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
    });

    return {
      queue_entry_id: updated.id,
      queue_id: queueId,
      ticket_number: updated.ticketNumber,
      status: updated.status,
      updated_at: updated.updatedAt.toISOString(),
      notes: updated.notes,
    };
  }

  async getTrackingStatus(trackingToken: string) {
    return this.queueRead.getTrackingStatus(trackingToken);
  }

  async getMyQueueEntry(queueId: number, patientId: number) {
    return this.queueRead.getMyQueueEntry(queueId, patientId);
  }
}

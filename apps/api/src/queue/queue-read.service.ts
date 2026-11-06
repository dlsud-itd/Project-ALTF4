import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, QueueSource, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueEventsService } from './queue-events.service';

export const ACTIVE_QUEUE_STATUSES = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_SERVICE,
] as const;

@Injectable()
export class QueueReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: QueueEventsService,
  ) {}

  async getQueueOrThrow(queueId: number) {
    const queue = await this.prisma.dailyQueue.findUnique({
      where: { id: queueId },
    });

    if (!queue) {
      throw new NotFoundException({
        code: 'QUEUE_NOT_FOUND',
        message: 'The target queue session was not found.',
      });
    }

    return queue;
  }

  hashTrackingToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async getOrderedWaitingEntries(queueId: number) {
    return this.prisma.queueEntry.findMany({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.WAITING,
      },
      orderBy: { queueNumber: 'asc' },
      select: {
        id: true,
        queueNumber: true,
        source: true,
        ticketNumber: true,
        status: true,
      },
    });
  }

  async expireCalledEntries(
    queueId: number,
    now = new Date(),
    tx: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    const expiredEntries = await tx.queueEntry.findMany({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.CALLED,
        graceExpiresAt: { lte: now },
      },
      select: { id: true, ticketNumber: true },
    });

    for (const entry of expiredEntries) {
      const expired = await tx.queueEntry.updateMany({
        where: {
          id: entry.id,
          dailyQueueId: queueId,
          status: QueueStatus.CALLED,
          graceExpiresAt: { lte: now },
        },
        data: { status: QueueStatus.NO_SHOW },
      });

      if (expired.count === 0) {
        continue;
      }

      await this.recordStatusHistory(tx, entry.id, QueueStatus.NO_SHOW);
      this.events.emit(queueId, 'queue:updated', {
        queueId,
        queueEntryId: entry.id,
        ticketNumber: entry.ticketNumber,
        status: QueueStatus.NO_SHOW,
        timestamp: now.toISOString(),
      });
    }
  }

  async getQueuePositionAndWait(
    queueId: number,
    queue: { fallbackServiceMinutes: number },
    entryId: number,
  ) {
    const waitingEntries = await this.getOrderedWaitingEntries(queueId);
    const rank = waitingEntries.findIndex((entry) => entry.id === entryId);
    const position = rank >= 0 ? rank + 1 : waitingEntries.length + 1;
    const estimatedWaitMinutes = position * queue.fallbackServiceMinutes;

    return { position, estimatedWaitMinutes };
  }

  async recordStatusHistory(
    tx: Prisma.TransactionClient | PrismaClient,
    entryId: number,
    status: QueueStatus,
  ) {
    await tx.queueStatusHistory.create({
      data: {
        queueEntryId: entryId,
        status,
      },
    });
  }

  async getQueueStatus(queueId: number) {
    const queue = await this.getQueueOrThrow(queueId);
    await this.expireCalledEntries(queueId);
    const waitingEntries = await this.getOrderedWaitingEntries(queueId);
    const calledEntry = await this.prisma.queueEntry.findFirst({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.CALLED,
      },
      orderBy: { calledAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        calledAt: true,
        graceExpiresAt: true,
        roomNumber: true,
      },
    });
    const currentServing =
      calledEntry ??
      (await this.prisma.queueEntry.findFirst({
        where: {
          dailyQueueId: queueId,
          status: QueueStatus.IN_SERVICE,
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          calledAt: true,
          graceExpiresAt: true,
          roomNumber: true,
        },
      }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalCompletedToday = await this.prisma.queueEntry.count({
      where: {
        dailyQueueId: queueId,
        status: { in: [QueueStatus.DONE, QueueStatus.SERVED] },
        updatedAt: { gte: today },
      },
    });

    const waitingBreakdown = {
      ONLINE: waitingEntries.filter(
        (entry) => entry.source === QueueSource.ONLINE,
      ).length,
      WALK_IN: waitingEntries.filter(
        (entry) => entry.source === QueueSource.WALK_IN,
      ).length,
      STAFF_GENERATED: waitingEntries.filter(
        (entry) => entry.source === QueueSource.STAFF_GENERATED,
      ).length,
    };

    const averageWaitMinutes = waitingEntries.length
      ? Math.round(
          waitingEntries.reduce(
            (sum, entry, index) =>
              sum + (index + 1) * queue.fallbackServiceMinutes,
            0,
          ) / waitingEntries.length,
        )
      : 0;
    const serverTime = new Date().toISOString();
    const servingTicket = currentServing
      ? {
          ticket_number: currentServing.ticketNumber,
          queue_entry_id: currentServing.id,
          status: currentServing.status,
          called_at: currentServing.calledAt?.toISOString() || null,
          grace_expires_at:
            currentServing.graceExpiresAt?.toISOString() || null,
          room_number: currentServing.roomNumber || 'Counter 1',
        }
      : null;

    return {
      queue_id: queueId,
      clinic_date: queue.clinicDate.toISOString().split('T')[0],
      is_active: queue.isOpen,
      currently_serving: servingTicket,
      current_serving: servingTicket,
      total_waiting: waitingEntries.length,
      waiting_tickets: waitingEntries.map((entry) => ({
        queue_entry_id: entry.id,
        ticket_number: entry.ticketNumber,
        status: entry.status,
      })),
      waiting_breakdown: waitingBreakdown,
      total_completed_today: totalCompletedToday,
      avg_wait_time_minutes: averageWaitMinutes,
      average_wait_minutes: averageWaitMinutes,
      server_time: serverTime,
      last_updated: serverTime,
    };
  }

  async getTrackingStatus(trackingToken: string) {
    const hashedToken = this.hashTrackingToken(trackingToken);
    await this.expireCalledEntriesForToken(trackingToken);
    const entry = await this.prisma.queueEntry.findFirst({
      where: { trackingToken: hashedToken },
      select: {
        id: true,
        dailyQueueId: true,
        ticketNumber: true,
        status: true,
        graceExpiresAt: true,
      },
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'TRACKING_TOKEN_NOT_FOUND',
        message: 'No active queue entry matches the tracking token.',
      });
    }

    const queue = await this.getQueueOrThrow(entry.dailyQueueId);
    const { position } = await this.getQueuePositionAndWait(
      entry.dailyQueueId,
      queue,
      entry.id,
    );

    return {
      ticket_number: entry.ticketNumber,
      status: entry.status,
      position_in_queue: position,
      ...(entry.status === QueueStatus.CALLED && entry.graceExpiresAt
        ? {
            time_remaining_seconds: Math.max(
              0,
              Math.ceil((entry.graceExpiresAt.getTime() - Date.now()) / 1000),
            ),
          }
        : {}),
    };
  }

  async getMyQueueEntry(queueId: number, patientId: number) {
    const queue = await this.getQueueOrThrow(queueId);
    await this.expireCalledEntries(queueId);

    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        dailyQueueId: queueId,
        patientId,
        status: { in: [...ACTIVE_QUEUE_STATUSES] },
      },
      select: {
        id: true,
        dailyQueueId: true,
        ticketNumber: true,
        status: true,
        roomNumber: true,
        joinedAt: true,
        calledAt: true,
        graceExpiresAt: true,
      },
    });

    if (!entry) {
      return null;
    }

    const { position, estimatedWaitMinutes } =
      await this.getQueuePositionAndWait(queueId, queue, entry.id);

    return {
      queue_entry_id: entry.id,
      queue_id: entry.dailyQueueId,
      ticket_number: entry.ticketNumber,
      position_in_queue: position,
      estimated_wait_minutes: estimatedWaitMinutes,
      status: entry.status,
      room_number: entry.roomNumber,
      joined_at: entry.joinedAt.toISOString(),
      called_at: entry.calledAt ? entry.calledAt.toISOString() : null,
      grace_expires_at: entry.graceExpiresAt
        ? entry.graceExpiresAt.toISOString()
        : null,
    };
  }

  private async expireCalledEntriesForToken(trackingToken: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { trackingToken: this.hashTrackingToken(trackingToken) },
      select: { dailyQueueId: true },
    });
    if (entry) {
      await this.expireCalledEntries(entry.dailyQueueId);
    }
  }
}

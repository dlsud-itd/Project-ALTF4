import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, QueueSource, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTIVE_QUEUE_STATUSES,
  DEFAULT_SERVICE_DURATION_MINUTES,
} from '../common/clinic.constants';
import {
  estimateQueueWaitMinutes,
  getAverageServiceDurationMinutes,
} from '../common/queue-wait.util';
import { QueueEventsService } from './queue-events.service';
import { QueueLifecycleService } from './queue-lifecycle.service';
import { presentServingTicket, presentWaitingTicket } from './queue-presenter';

export const GRACE_PERIOD_MS = 3 * 60 * 1000;

@Injectable()
export class QueueReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: QueueEventsService,
    private readonly lifecycle: QueueLifecycleService,
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

  async getOrderedWaitingEntries(queueId: number, queueClinicDate?: Date) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let targetDateStr = todayStr;
    if (queueClinicDate) {
      targetDateStr = queueClinicDate.toISOString().split('T')[0];
    } else {
      const q = await this.prisma.dailyQueue.findUnique({
        where: { id: queueId },
        select: { clinicDate: true },
      });
      if (q?.clinicDate) {
        targetDateStr = q.clinicDate.toISOString().split('T')[0];
      }
    }

    const entries = await this.prisma.queueEntry.findMany({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.WAITING,
      },
      orderBy: [{ createdAt: 'asc' }, { queueNumber: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        queueNumber: true,
        source: true,
        ticketNumber: true,
        status: true,
        firstName: true,
        lastName: true,
        reasonForVisit: true,
        appointment: {
          select: {
            slot: {
              select: {
                clinicDate: true,
              },
            },
          },
        },
      },
    });

    return entries.filter((entry) => {
      const apptDate = (
        entry as { appointment?: { slot?: { clinicDate?: Date } } | null }
      ).appointment?.slot?.clinicDate;
      if (!apptDate) {
        return true;
      }
      const apptDateStr = apptDate.toISOString().split('T')[0];
      return apptDateStr === targetDateStr && apptDateStr === todayStr;
    });
  }

  async expireCalledEntries(
    queueId: number,
    now = new Date(),
  ): Promise<string[]> {
    const expiredEntries = await this.prisma.queueEntry.findMany({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.CALLED,
        graceExpiresAt: { lte: now },
      },
      select: { id: true, ticketNumber: true },
    });
    const newlyNoShowTickets: string[] = [];

    for (const entry of expiredEntries) {
      const updated = await this.prisma.$transaction((tx) =>
        this.lifecycle.transitionEntry(tx, {
          queueId,
          entryId: entry.id,
          requestedStatus: QueueStatus.NO_SHOW,
          now,
          ignoreConcurrentChange: true,
        }),
      );
      if (!updated) {
        continue;
      }

      newlyNoShowTickets.push(updated.ticketNumber);
      this.events.emit(queueId, 'queue:updated', {
        queueId,
        queueEntryId: updated.id,
        ticketNumber: updated.ticketNumber,
        status: QueueStatus.NO_SHOW,
        timestamp: now.toISOString(),
        noShowAt: updated.noShowAt?.toISOString() ?? null,
      });
    }

    return newlyNoShowTickets;
  }

  async getQueuePositionAndWait(
    queueId: number,
    queue: { fallbackServiceMinutes: number },
    entryId: number,
  ) {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id: entryId },
      select: { queueNumber: true },
    });
    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }

    const [ticketsAhead, completedTickets] = await Promise.all([
      this.prisma.queueEntry.count({
        where: {
          dailyQueueId: queueId,
          status: { in: [...ACTIVE_QUEUE_STATUSES] },
          queueNumber: { lt: entry.queueNumber },
        },
      }),
      this.prisma.queueEntry.findMany({
        where: { dailyQueueId: queueId, status: QueueStatus.COMPLETED },
        select: {
          consultationStartedAt: true,
          completedAt: true,
        },
      }),
    ]);
    const serviceDurationMinutes = getAverageServiceDurationMinutes(
      completedTickets,
      queue.fallbackServiceMinutes ?? DEFAULT_SERVICE_DURATION_MINUTES,
    );
    const position = ticketsAhead + 1;
    const estimatedWaitMinutes = estimateQueueWaitMinutes(
      ticketsAhead,
      serviceDurationMinutes,
    );

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

  async getQueueStatus(queueId: number, includePatientDetails = false) {
    const queue = await this.getQueueOrThrow(queueId);
    const newlyNoShowTickets = await this.expireCalledEntries(queueId);
    const waitingEntries = await this.getOrderedWaitingEntries(
      queueId,
      queue.clinicDate,
    );
    const currentServing = await this.prisma.queueEntry.findFirst({
      where: {
        dailyQueueId: queueId,
        status: {
          in: [QueueStatus.CALLED, QueueStatus.IN_CONSULTATION],
        },
      },
      orderBy: [{ calledAt: 'desc' }, { queueNumber: 'desc' }],
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        calledAt: true,
        graceExpiresAt: true,
        roomNumber: true,
        provider: true,
        firstName: true,
        lastName: true,
        reasonForVisit: true,
        appointment: {
          select: {
            slot: {
              select: {
                clinicDate: true,
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const servingApptDate = (
      currentServing as {
        appointment?: { slot?: { clinicDate?: Date } } | null;
      }
    )?.appointment?.slot?.clinicDate
      ?.toISOString()
      .split('T')[0];
    const validCurrentServing =
      servingApptDate && servingApptDate !== todayStr ? null : currentServing;

    let totalCompletedToday = 0;
    let totalNoShowsToday = 0;
    let waitingBreakdown:
      { ONLINE: number; WALK_IN: number; STAFF_GENERATED: number } | undefined;
    if (includePatientDetails) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      [totalCompletedToday, totalNoShowsToday] = await Promise.all([
        this.prisma.queueEntry.count({
          where: {
            dailyQueueId: queueId,
            status: QueueStatus.COMPLETED,
            completedAt: { gte: today },
          },
        }),
        this.prisma.queueEntry.count({
          where: {
            dailyQueueId: queueId,
            status: QueueStatus.NO_SHOW,
            noShowAt: { gte: today },
          },
        }),
      ]);
      waitingBreakdown = {
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
    }

    const completedTickets = await this.prisma.queueEntry.findMany({
      where: { dailyQueueId: queueId, status: QueueStatus.COMPLETED },
      select: {
        consultationStartedAt: true,
        completedAt: true,
      },
    });
    const serviceDurationMinutes = getAverageServiceDurationMinutes(
      completedTickets,
      queue.fallbackServiceMinutes ?? DEFAULT_SERVICE_DURATION_MINUTES,
    );
    const averageWaitMinutes = waitingEntries.length
      ? Math.round(
          waitingEntries.reduce(
            (sum, _entry, index) =>
              sum + estimateQueueWaitMinutes(index, serviceDurationMinutes),
            0,
          ) / waitingEntries.length,
        )
      : 0;
    const serverTime = new Date().toISOString();
    const servingTicket = presentServingTicket(
      validCurrentServing,
      includePatientDetails,
    );

    const response = {
      queue_id: queueId,
      clinic_date: queue.clinicDate.toISOString().split('T')[0],
      is_active: queue.isOpen,
      currently_serving: servingTicket,
      current_serving: servingTicket,
      total_waiting: waitingEntries.length,
      waiting_tickets: waitingEntries.map((entry) =>
        presentWaitingTicket(entry, includePatientDetails),
      ),
      avg_wait_time_minutes: averageWaitMinutes,
      average_wait_minutes: averageWaitMinutes,
      server_time: serverTime,
      last_updated: serverTime,
    };
    return includePatientDetails
      ? {
          ...response,
          waiting_breakdown: waitingBreakdown,
          total_completed_today: totalCompletedToday,
          total_no_shows_today: totalNoShowsToday,
          grace_period_ms: GRACE_PERIOD_MS,
          newly_no_show_ticket_numbers: newlyNoShowTickets,
        }
      : response;
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
    const { position, estimatedWaitMinutes } =
      await this.getQueuePositionAndWait(entry.dailyQueueId, queue, entry.id);

    return {
      ticket_number: entry.ticketNumber,
      status: entry.status,
      position_in_queue: position,
      estimated_wait_minutes: estimatedWaitMinutes,
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

  async getOrCreateTodayQueue() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

    let queue = await this.prisma.dailyQueue.findUnique({
      where: { clinicDate: todayDate },
    });

    if (!queue) {
      queue = await this.prisma.dailyQueue.create({
        data: {
          clinicDate: todayDate,
          isOpen: true,
          nextNumber: 1,
          fallbackServiceMinutes: DEFAULT_SERVICE_DURATION_MINUTES,
        },
      });
    }

    return {
      id: queue.id,
      clinic_date: queue.clinicDate.toISOString().split('T')[0],
      is_open: queue.isOpen,
      fallback_service_minutes: queue.fallbackServiceMinutes,
    };
  }

  async getMyQueueEntry(queueId: number, patientId: number) {
    const defaultQueue = await this.getQueueOrThrow(queueId);
    await this.expireCalledEntries(queueId);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

    // Look for active queue entry across target queue or today/future queues
    let entry = await this.prisma.queueEntry.findFirst({
      where: {
        dailyQueueId: queueId,
        patientId,
        status: { in: [...ACTIVE_QUEUE_STATUSES] },
        dailyQueue: {
          clinicDate: { gte: todayDate },
        },
      },
      select: {
        id: true,
        dailyQueueId: true,
        ticketNumber: true,
        status: true,
        roomNumber: true,
        createdAt: true,
        calledAt: true,
        graceExpiresAt: true,
      },
      orderBy: { id: 'desc' },
    });

    if (!entry) {
      entry = await this.prisma.queueEntry.findFirst({
        where: {
          patientId,
          status: { in: [...ACTIVE_QUEUE_STATUSES] },
          dailyQueue: {
            clinicDate: { gte: todayDate },
          },
        },
        select: {
          id: true,
          dailyQueueId: true,
          ticketNumber: true,
          status: true,
          roomNumber: true,
          createdAt: true,
          calledAt: true,
          graceExpiresAt: true,
        },
        orderBy: { id: 'desc' },
      });
    }

    if (!entry) {
      return null;
    }

    const targetQueueId = entry.dailyQueueId;
    const queue =
      targetQueueId === queueId
        ? defaultQueue
        : await this.getQueueOrThrow(targetQueueId);

    const { position, estimatedWaitMinutes } =
      await this.getQueuePositionAndWait(targetQueueId, queue, entry.id);

    return {
      queue_entry_id: entry.id,
      queue_id: entry.dailyQueueId,
      ticket_number: entry.ticketNumber,
      position_in_queue: position,
      estimated_wait_minutes: estimatedWaitMinutes,
      status: entry.status,
      room_number: entry.roomNumber,
      joined_at: entry.createdAt.toISOString(),
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

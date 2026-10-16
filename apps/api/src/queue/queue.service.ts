import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueGateway } from './queue.gateway';
import { WalkInDto } from './dto/walk-in.dto';
import { CallNextDto } from './dto/call-next.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';
import { QueueStatus, QueuePriority } from '@prisma/client';

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueGateway: QueueGateway,
  ) {}

  async joinWalkIn(queueId: number, dto: WalkInDto) {
    const queue = await this.prisma.dailyQueue.findUnique({
      where: { id: queueId },
    });

    if (!queue) {
      throw new NotFoundException('QUEUE_NOT_FOUND: The target queue session was not found.');
    }

    if (!queue.isOpen) {
      throw new BadRequestException('QUEUE_CLOSED: The specified queue session is no longer accepting walk-in registrations.');
    }

    const nextNumber = queue.nextNumber;
    const ticketPrefix = dto.priority === QueuePriority.EMERGENCY ? 'E' : 'A';
    const ticketNumber = `${ticketPrefix}-${String(nextNumber).padStart(3, '0')}`;
    const trackingToken = `trk_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).substring(4)}`;

    const waitingCount = await this.prisma.queueEntry.count({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.WAITING,
      },
    });

    const positionInQueue = waitingCount + 1;
    const estimatedWaitMinutes = positionInQueue * queue.fallbackServiceMinutes;

    const [createdEntry] = await this.prisma.$transaction([
      this.prisma.queueEntry.create({
        data: {
          dailyQueueId: queueId,
          queueNumber: nextNumber,
          ticketNumber,
          status: QueueStatus.WAITING,
          priority: dto.priority || QueuePriority.NORMAL,
          trackingToken,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phoneNumber: dto.phoneNumber,
          reasonForVisit: dto.reasonForVisit,
        },
      }),
      this.prisma.dailyQueue.update({
        where: { id: queueId },
        data: { nextNumber: { increment: 1 } },
      }),
    ]);

    this.queueGateway.emitQueueUpdated({
      queueId,
      queueEntryId: createdEntry.id,
      ticketNumber,
      status: QueueStatus.WAITING,
      totalWaiting: positionInQueue,
      timestamp: createdEntry.joinedAt.toISOString(),
    });

    return {
      queue_entry_id: createdEntry.id,
      queue_id: queueId,
      ticket_number: ticketNumber,
      position_in_queue: positionInQueue,
      estimated_wait_minutes: estimatedWaitMinutes,
      status: createdEntry.status,
      priority: createdEntry.priority,
      tracking_token: trackingToken,
      joined_at: createdEntry.joinedAt.toISOString(),
    };
  }

  async getQueueStatus(queueId: number) {
    const queue = await this.prisma.dailyQueue.findUnique({
      where: { id: queueId },
    });

    if (!queue) {
      throw new NotFoundException('QUEUE_NOT_FOUND: The target queue session was not found.');
    }

    const totalWaiting = await this.prisma.queueEntry.count({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.WAITING,
      },
    });

    const totalCompletedToday = await this.prisma.queueEntry.count({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.SERVED,
      },
    });

    const currentlyServingEntry = await this.prisma.queueEntry.findFirst({
      where: {
        dailyQueueId: queueId,
        status: { in: [QueueStatus.CALLED, QueueStatus.IN_SERVICE] },
      },
      orderBy: { calledAt: 'desc' },
    });

    const statusData = {
      queue_id: queueId,
      clinic_date: queue.clinicDate.toISOString().split('T')[0],
      is_active: queue.isOpen,
      currently_serving: currentlyServingEntry
        ? {
            ticket_number: currentlyServingEntry.ticketNumber,
            called_at: currentlyServingEntry.calledAt?.toISOString() || null,
            room_number: currentlyServingEntry.roomNumber || 'Counter 1',
          }
        : null,
      total_waiting: totalWaiting,
      total_completed_today: totalCompletedToday,
      avg_wait_time_minutes: queue.fallbackServiceMinutes,
      last_updated: new Date().toISOString(),
    };

    return statusData;
  }

  async callNext(queueId: number, dto: CallNextDto) {
    const queue = await this.prisma.dailyQueue.findUnique({
      where: { id: queueId },
    });

    if (!queue) {
      throw new NotFoundException('QUEUE_NOT_FOUND: Queue not found');
    }

    const nextEntry = await this.prisma.queueEntry.findFirst({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.WAITING,
      },
      orderBy: [
        { priority: 'desc' }, // EMERGENCY before NORMAL
        { joinedAt: 'asc' },
      ],
    });

    if (!nextEntry) {
      throw new BadRequestException('QUEUE_EMPTY: No waiting patients currently in the queue to call.');
    }

    const calledAt = new Date();

    const updatedEntry = await this.prisma.queueEntry.update({
      where: { id: nextEntry.id },
      data: {
        status: QueueStatus.CALLED,
        calledAt,
        roomNumber: dto.roomNumber,
      },
    });

    const patientName = `${updatedEntry.firstName || ''} ${updatedEntry.lastName || ''}`.trim() || 'Patient';

    this.queueGateway.emitQueueCalled({
      queueId,
      queueEntryId: updatedEntry.id,
      ticketNumber: updatedEntry.ticketNumber,
      patientName,
      roomNumber: dto.roomNumber,
      calledAt: calledAt.toISOString(),
    });

    return {
      queue_entry_id: updatedEntry.id,
      ticket_number: updatedEntry.ticketNumber,
      patient_name: patientName,
      status: updatedEntry.status,
      called_at: calledAt.toISOString(),
      room_number: dto.roomNumber,
    };
  }

  async updateEntryStatus(queueId: number, entryId: number, dto: UpdateEntryStatusDto) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        id: entryId,
        dailyQueueId: queueId,
      },
    });

    if (!entry) {
      throw new NotFoundException('ENTRY_NOT_FOUND: Queue entry not found');
    }

    const updated = await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        notes: dto.notes ?? entry.notes,
      },
    });

    const totalWaiting = await this.prisma.queueEntry.count({
      where: {
        dailyQueueId: queueId,
        status: QueueStatus.WAITING,
      },
    });

    this.queueGateway.emitQueueUpdated({
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
}

import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { QueueSource, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueEventsService } from './queue-events.service';
import { QueueReadService } from './queue-read.service';
import { QueueService } from './queue.service';

const now = new Date('2026-11-06T00:00:00.000Z');
const queue = {
  id: 1,
  clinicDate: new Date('2026-11-06T00:00:00.000Z'),
  nextNumber: 1,
  isOpen: true,
  fallbackServiceMinutes: 15,
};

function makeEntry(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 10,
    dailyQueueId: 1,
    patientId: null,
    appointmentId: null,
    queueNumber: 1,
    ticketNumber: 'A-001',
    source: QueueSource.WALK_IN,
    status: QueueStatus.WAITING,
    priority: 'NORMAL',
    trackingToken: null,
    firstName: 'Ada Lovelace',
    lastName: null,
    phoneNumber: 'private phone',
    reasonForVisit: 'private reason',
    roomNumber: null,
    notes: null,
    joinedAt: now,
    calledAt: null,
    graceExpiresAt: null,
    updatedAt: now,
    ...overrides,
  };
}

describe('QueueService', () => {
  const tx = {
    $queryRaw: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    dailyQueue: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    queueEntry: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      updateMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    queueStatusHistory: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };
  const prisma = {
    $transaction: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    dailyQueue: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    queueEntry: {
      count: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      updateMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    queueStatusHistory: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };
  let service: QueueService;
  let events: QueueEventsService;

  beforeEach(() => {
    for (const model of Object.values(tx)) {
      if (typeof model === 'object' && model !== null) {
        Object.values(model).forEach((mock) => mock.mockReset());
      }
    }
    for (const model of Object.values(prisma)) {
      if (typeof model === 'object' && model !== null) {
        Object.values(model).forEach((mock) => mock.mockReset());
      }
    }

    prisma.$transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args[0] as (client: typeof tx) => Promise<unknown>;
      return callback(tx);
    });
    prisma.dailyQueue.findUnique.mockResolvedValue(queue);
    tx.queueStatusHistory.create.mockResolvedValue({ id: 1 });
    tx.dailyQueue.findUnique.mockResolvedValue(queue);
    prisma.queueStatusHistory.create.mockResolvedValue({ id: 1 });
    prisma.queueEntry.findMany.mockResolvedValue([]);
    events = new QueueEventsService();
    service = new QueueService(
      prisma as unknown as PrismaService,
      events,
      new QueueReadService(prisma as unknown as PrismaService, events),
    );
  });

  it('creates sequential A tickets with a secure tracking token using only name', async () => {
    const created = makeEntry({
      trackingToken: 'hashed',
      joinedAt: now,
    });
    tx.dailyQueue.update.mockResolvedValue({ ...queue, nextNumber: 2 });
    tx.queueEntry.create.mockResolvedValue(created);
    prisma.queueEntry.findMany.mockResolvedValue([created]);

    const result = await service.joinWalkIn(1, { name: 'Jane Doe' });

    const createArgs = tx.queueEntry.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        ticketNumber: 'A-001',
        queueNumber: 1,
        firstName: 'Jane Doe',
        status: QueueStatus.WAITING,
      }),
    );
    expect(result.tracking_token).toMatch(/^trk_[a-f0-9]{16}$/);
    expect(result).not.toHaveProperty('priority');
    expect(result).not.toHaveProperty('phoneNumber');
  });

  it('calls waiting tickets in ascending ticket-number order', async () => {
    const eventPayloads: unknown[] = [];
    const subscription = service
      .getQueueEvents(1)
      .subscribe((event) => eventPayloads.push(event.data));
    const waiting = makeEntry({
      id: 20,
      queueNumber: 2,
      ticketNumber: 'A-002',
    });
    const called = makeEntry({
      ...waiting,
      status: QueueStatus.CALLED,
      calledAt: now,
      graceExpiresAt: new Date(now.getTime() + 180_000),
    });
    tx.queueEntry.findMany.mockResolvedValue([]);
    tx.queueEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(waiting);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(called);

    const result = await service.callNext(1, {
      roomNumber: 'Counter 1',
      practitionerId: 'staff-1',
    });

    expect(tx.queueEntry.findFirst).toHaveBeenNthCalledWith(2, {
      where: { dailyQueueId: 1, status: QueueStatus.WAITING },
      orderBy: { queueNumber: 'asc' },
      select: { id: true },
    });
    expect(result.ticket_number).toBe('A-002');
    expect(
      new Date(result.grace_expires_at).getTime() -
        new Date(result.called_at).getTime(),
    ).toBe(180_000);
    expect(JSON.stringify(eventPayloads)).not.toContain('Ada Lovelace');
    subscription.unsubscribe();
  });

  it('rejects another call while a patient remains CALLED', async () => {
    tx.queueEntry.findMany.mockResolvedValue([]);
    tx.queueEntry.findFirst.mockResolvedValue(
      makeEntry({
        status: QueueStatus.CALLED,
        graceExpiresAt: new Date(now.getTime() + 60_000),
      }),
    );

    await expect(
      service.callNext(1, {
        roomNumber: 'Counter 1',
        practitionerId: 'staff-1',
      }),
    ).rejects.toThrow(ConflictException);
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
  });

  it('marks an expired CALLED ticket NO_SHOW only once', async () => {
    const expired = makeEntry({
      status: QueueStatus.CALLED,
      graceExpiresAt: new Date(now.getTime() - 1),
    });
    prisma.queueEntry.findMany.mockImplementation((...args: unknown[]) => {
      const query = args[0] as { where: { status: QueueStatus } };
      return Promise.resolve(
        query.where.status === QueueStatus.CALLED
          ? [{ id: expired.id, ticketNumber: expired.ticketNumber }]
          : [],
      );
    });
    prisma.queueEntry.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.queueEntry.findFirst.mockResolvedValue(null);
    prisma.queueEntry.count.mockResolvedValue(0);

    await service.getQueueStatus(1);
    await service.getQueueStatus(1);

    expect(prisma.queueEntry.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.queueStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(prisma.queueStatusHistory.create).toHaveBeenCalledWith({
      data: { queueEntryId: expired.id, status: QueueStatus.NO_SHOW },
    });
  });

  it('accepts arrival before expiry and clears the deadline', async () => {
    const called = makeEntry({
      status: QueueStatus.CALLED,
      graceExpiresAt: new Date(Date.now() + 60_000),
    });
    const arrived = makeEntry({
      ...called,
      status: QueueStatus.IN_SERVICE,
      graceExpiresAt: null,
    });
    prisma.queueEntry.findFirst.mockResolvedValue(called);
    prisma.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    prisma.queueEntry.findUnique.mockResolvedValue(arrived);
    prisma.queueEntry.count.mockResolvedValue(0);

    const result = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.IN_SERVICE,
    });

    const updateArgs = prisma.queueEntry.updateMany.mock.calls[0]?.[0] as {
      where: {
        status: QueueStatus;
        graceExpiresAt: { gt: Date };
      };
      data: { status: QueueStatus; graceExpiresAt: null };
    };
    expect(updateArgs.where.status).toBe(QueueStatus.CALLED);
    expect(updateArgs.where.graceExpiresAt.gt).toBeInstanceOf(Date);
    expect(updateArgs.data).toEqual({
      status: QueueStatus.IN_SERVICE,
      graceExpiresAt: null,
    });
    expect(result.status).toBe(QueueStatus.IN_SERVICE);
  });

  it('rejects arrival after expiry and expires the ticket as NO_SHOW', async () => {
    const called = makeEntry({
      status: QueueStatus.CALLED,
      graceExpiresAt: new Date(Date.now() - 1),
    });
    prisma.queueEntry.findFirst.mockResolvedValue(called);
    prisma.queueEntry.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.queueEntry.findMany.mockResolvedValue([
      { id: called.id, ticketNumber: called.ticketNumber },
    ]);

    await expect(
      service.updateEntryStatus(1, 10, { status: QueueStatus.IN_SERVICE }),
    ).rejects.toThrow(ConflictException);

    const expiryArgs = prisma.queueEntry.updateMany.mock.calls[1]?.[0] as {
      where: { status: QueueStatus };
      data: { status: QueueStatus };
    };
    expect(expiryArgs.where.status).toBe(QueueStatus.CALLED);
    expect(expiryArgs.data.status).toBe(QueueStatus.NO_SHOW);
  });

  it('returns only public ticket status fields from token tracking', async () => {
    const entry = makeEntry({
      status: QueueStatus.WAITING,
      trackingToken: 'hashed',
    });
    prisma.queueEntry.findFirst
      .mockResolvedValueOnce({ dailyQueueId: 1 })
      .mockResolvedValueOnce(entry);
    prisma.queueEntry.findMany.mockResolvedValue([]);
    prisma.dailyQueue.findUnique.mockResolvedValue(queue);

    const result = await service.getTrackingStatus('trk_0123456789abcdef');

    expect(result).toEqual({
      ticket_number: 'A-001',
      status: QueueStatus.WAITING,
      position_in_queue: 1,
    });
    expect(result).not.toHaveProperty('firstName');
    expect(result).not.toHaveProperty('lastName');
    expect(result).not.toHaveProperty('phoneNumber');
    expect(result).not.toHaveProperty('reasonForVisit');
  });

  it('includes only the remaining grace time when a tracked ticket is CALLED', async () => {
    const entry = makeEntry({
      status: QueueStatus.CALLED,
      graceExpiresAt: new Date(Date.now() + 60_000),
      trackingToken: 'hashed',
    });
    prisma.queueEntry.findFirst
      .mockResolvedValueOnce({ dailyQueueId: 1 })
      .mockResolvedValueOnce(entry);
    prisma.queueEntry.findMany.mockResolvedValue([]);
    prisma.dailyQueue.findUnique.mockResolvedValue(queue);

    const result = await service.getTrackingStatus('trk_0123456789abcdef');

    expect(result).toHaveProperty('time_remaining_seconds');
    expect(Object.keys(result).sort()).toEqual([
      'position_in_queue',
      'status',
      'ticket_number',
      'time_remaining_seconds',
    ]);
  });
});

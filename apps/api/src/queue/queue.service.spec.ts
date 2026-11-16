import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { Prisma, QueueSource, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueEventsService } from './queue-events.service';
import { QueueLifecycleService } from './queue-lifecycle.service';
import { QueueReadService } from './queue-read.service';
import { QueueService } from './queue.service';

const now = new Date('2026-11-06T00:00:00.000Z');
const anyDate = (): unknown => expect.any(Date);
const anyString = (): unknown => expect.any(String);
const objectContaining = (sample: Record<string, unknown>): unknown =>
  expect.objectContaining(sample);
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
    createdAt: now,
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
    appointment: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      updateMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
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
  let lifecycle: QueueLifecycleService;

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
    tx.appointment.findUnique.mockResolvedValue(null);
    tx.appointment.updateMany.mockResolvedValue({ count: 1 });
    tx.dailyQueue.findUnique.mockResolvedValue(queue);
    prisma.queueStatusHistory.create.mockResolvedValue({ id: 1 });
    prisma.queueEntry.findMany.mockResolvedValue([]);
    events = new QueueEventsService();
    lifecycle = new QueueLifecycleService(prisma as unknown as PrismaService);
    const queueRead = new QueueReadService(
      prisma as unknown as PrismaService,
      events,
      lifecycle,
    );
    service = new QueueService(
      prisma as unknown as PrismaService,
      events,
      queueRead,
      lifecycle,
    );
  });

  it('creates sequential A tickets with a secure tracking token using only name', async () => {
    const created = makeEntry({
      trackingToken: 'hashed',
      createdAt: now,
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

  it('continues ticket numbering after the highest existing queue number', async () => {
    const created = makeEntry({
      queueNumber: 59,
      ticketNumber: 'A-059',
      createdAt: now,
    });
    tx.dailyQueue.update.mockResolvedValue({ ...queue, nextNumber: 2 });
    tx.queueEntry.findFirst.mockResolvedValue({ queueNumber: 58 });
    tx.queueEntry.create.mockResolvedValue(created);
    prisma.queueEntry.findMany.mockResolvedValue([created]);

    const result = await service.joinWalkIn(1, { name: 'Jane Doe' });

    const createArgs = tx.queueEntry.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        ticketNumber: 'A-059',
        queueNumber: 59,
      }),
    );
    expect(tx.dailyQueue.update).toHaveBeenNthCalledWith(2, {
      where: { id: 1 },
      data: { nextNumber: 60 },
    });
    expect(result.ticket_number).toBe('A-059');
  });

  it('calls the oldest eligible waiting ticket in deterministic order', async () => {
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
    prisma.queueEntry.findFirst.mockResolvedValue(waiting);
    tx.queueEntry.findFirst.mockResolvedValue(null);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(called);

    const result = await service.callNext(1, {
      room: 'Counter 1',
      provider: 'Dr. Ana Santos',
    });

    expect(prisma.queueEntry.findFirst).toHaveBeenCalledWith({
      where: { dailyQueueId: 1, status: QueueStatus.WAITING },
      orderBy: [{ createdAt: 'asc' }, { queueNumber: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    expect(result.ticket_number).toBe('A-002');
    expect(result.status).toBe(QueueStatus.CALLED);
    expect(result.grace_period_ms).toBe(180_000);
    expect(new Date(result.grace_expires_at).getTime()).toBe(
      new Date(result.called_at).getTime() + result.grace_period_ms,
    );
    expect(result).toMatchObject({
      room_number: 'Counter 1',
      provider: 'Dr. Ana Santos',
    });
    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          status: QueueStatus.CALLED,
          roomNumber: 'Counter 1',
          provider: 'Dr. Ana Santos',
          calledAt: anyDate(),
          graceExpiresAt: anyDate(),
        }),
      }),
    );
    expect(tx.queueStatusHistory.create).toHaveBeenCalledWith({
      data: { queueEntryId: called.id, status: QueueStatus.CALLED },
    });
    expect(JSON.stringify(eventPayloads)).not.toContain('Ada Lovelace');
    subscription.unsubscribe();
  });

  it('records a linked appointment queue entry as CALLED without completing the appointment', async () => {
    const waiting = makeEntry({
      appointmentId: 55,
      status: QueueStatus.WAITING,
    });
    const called = makeEntry({
      ...waiting,
      status: QueueStatus.CALLED,
      calledAt: now,
    });
    prisma.queueEntry.findFirst.mockResolvedValue(waiting);
    tx.queueEntry.findFirst.mockResolvedValue(null);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(called);

    await service.callNext(1, {
      room: 'Counter 1',
      provider: 'Clinic staff',
    });

    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          status: QueueStatus.CALLED,
          calledAt: anyDate(),
        }),
      }),
    );
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 QUEUE_EMPTY without claiming an entry', async () => {
    prisma.queueEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      service.callNext(1, { room: 'Counter 1', provider: 'Dr. Ana Santos' }),
    ).rejects.toMatchObject({
      response: { code: 'QUEUE_EMPTY', message: 'No patients are waiting.' },
      status: 409,
    });
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 STATION_BUSY when a patient is already active', async () => {
    const waiting = makeEntry();
    prisma.queueEntry.findFirst.mockResolvedValue(waiting);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findFirst.mockResolvedValue(
      makeEntry({ status: QueueStatus.IN_CONSULTATION }),
    );

    await expect(
      service.callNext(1, { room: 'Counter 1', provider: 'Dr. Ana Santos' }),
    ).rejects.toMatchObject({
      response: { code: 'STATION_BUSY' },
      status: 409,
    });
    expect(tx.queueStatusHistory.create).not.toHaveBeenCalled();
  });

  it('returns 409 ALREADY_CALLED when the conditional claim loses a race', async () => {
    prisma.queueEntry.findFirst.mockResolvedValue(makeEntry());
    tx.queueEntry.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.callNext(1, { room: 'Counter 1', provider: 'Dr. Ana Santos' }),
    ).rejects.toMatchObject({
      response: { code: 'ALREADY_CALLED' },
      status: 409,
    });
    expect(tx.queueStatusHistory.create).not.toHaveBeenCalled();
  });

  it('lets only one of two concurrent call-next requests claim the same ticket', async () => {
    const waiting = makeEntry();
    const called = makeEntry({ ...waiting, status: QueueStatus.CALLED });
    let hasClaimed = false;
    prisma.queueEntry.findFirst.mockResolvedValue(waiting);
    tx.queueEntry.findFirst.mockResolvedValue(null);
    tx.queueEntry.findUnique.mockResolvedValue(called);
    tx.queueEntry.updateMany.mockImplementation(() => {
      if (hasClaimed) {
        return Promise.resolve({ count: 0 });
      }
      hasClaimed = true;
      return Promise.resolve({ count: 1 });
    });

    const request = () =>
      service.callNext(1, {
        room: 'Counter 1',
        provider: 'Dr. Ana Santos',
      });
    const outcomes = await Promise.all([
      request().then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      ),
      request().then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      ),
    ]);

    expect(outcomes.filter((outcome) => 'value' in outcome)).toHaveLength(1);
    const conflict = outcomes.find((outcome) => 'error' in outcome);
    expect(conflict).toMatchObject({
      error: {
        response: { code: 'ALREADY_CALLED' },
        status: 409,
      },
    });
    expect(tx.queueStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid call-next room and provider values with named fields', async () => {
    await expect(
      service.callNext(1, { room: '   ', provider: 'P'.repeat(61) }),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid fields: room, provider.',
      },
      status: 400,
    });
    expect(prisma.queueEntry.findFirst).not.toHaveBeenCalled();
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
  });

  it('recalls the current called patient without changing calledAt', async () => {
    const eventPayloads: unknown[] = [];
    const subscription = service
      .getQueueEvents(1)
      .subscribe((event) => eventPayloads.push(event.data));
    const currentEntry = makeEntry({
      status: QueueStatus.CALLED,
      calledAt: now,
      roomNumber: 'Counter 2',
    });
    prisma.queueEntry.findFirst.mockResolvedValue(currentEntry);
    prisma.queueEntry.findMany.mockResolvedValue([]);

    const result = await service.recallCurrent(1);

    expect(result).toEqual({
      queue_entry_id: currentEntry.id,
      ticket_number: currentEntry.ticketNumber,
      status: QueueStatus.CALLED,
    });
    expect(JSON.stringify(eventPayloads)).toContain('"recalled":true');
    expect(prisma.queueEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dailyQueueId: 1, status: QueueStatus.CALLED },
      }),
    );
    expect(prisma.queueEntry.updateMany).not.toHaveBeenCalled();
    subscription.unsubscribe();
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
    tx.queueEntry.findFirst.mockResolvedValue(expired);
    tx.queueEntry.findUnique.mockResolvedValue(expired);
    tx.queueEntry.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.queueEntry.findFirst.mockResolvedValue(null);
    prisma.queueEntry.count.mockResolvedValue(0);

    await service.getQueueStatus(1);
    await service.getQueueStatus(1);

    expect(tx.queueEntry.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.queueStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.queueStatusHistory.create).toHaveBeenCalledWith({
      data: { queueEntryId: expired.id, status: QueueStatus.NO_SHOW },
    });
    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          status: QueueStatus.NO_SHOW,
          noShowAt: anyDate(),
        }),
      }),
    );
  });

  it('starts consultation before the grace deadline and clears the deadline', async () => {
    const called = makeEntry({
      status: QueueStatus.CALLED,
      graceExpiresAt: new Date(Date.now() + 60_000),
    });
    const inService = makeEntry({
      ...called,
      status: QueueStatus.IN_CONSULTATION,
      graceExpiresAt: null,
    });
    prisma.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(inService);
    prisma.queueEntry.count.mockResolvedValue(0);

    const result = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.IN_CONSULTATION,
    });

    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 10,
          dailyQueueId: 1,
          status: QueueStatus.CALLED,
        },
        data: objectContaining({
          status: QueueStatus.IN_CONSULTATION,
          consultationStartedAt: anyDate(),
          graceExpiresAt: null,
        }),
      }),
    );
    expect(result.status).toBe(QueueStatus.IN_CONSULTATION);
  });

  it('marks a called patient as no-show and saves noShowAt', async () => {
    const called = makeEntry({
      status: QueueStatus.CALLED,
      graceExpiresAt: new Date(Date.now() + 60_000),
    });
    const noShow = makeEntry({
      ...called,
      status: QueueStatus.NO_SHOW,
      noShowAt: now,
    });
    prisma.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(noShow);
    prisma.queueEntry.count.mockResolvedValue(0);

    const result = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.NO_SHOW,
    });

    expect(result).toMatchObject({
      status: QueueStatus.NO_SHOW,
      no_show_at: anyString(),
    });
    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 10,
          dailyQueueId: 1,
          status: QueueStatus.CALLED,
        },
        data: objectContaining({
          status: QueueStatus.NO_SHOW,
          noShowAt: anyDate(),
          graceExpiresAt: null,
        }),
      }),
    );
  });

  it('appends timestamped notes after stripping HTML instead of overwriting', async () => {
    const called = makeEntry({
      status: QueueStatus.CALLED,
      notes: 'Earlier note',
    });
    const updated = makeEntry({
      ...called,
      status: QueueStatus.IN_CONSULTATION,
      notes: `Earlier note\n[${now.toISOString()}] Follow-up needed`,
    });
    prisma.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(updated);
    prisma.queueEntry.count.mockResolvedValue(0);

    const result = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.IN_CONSULTATION,
      notes: '<b>Follow-up</b> <i>needed</i>',
    });

    const updateData = tx.queueEntry.updateMany.mock.calls[0]?.[0]?.data as {
      notes: string;
    };
    expect(updateData.notes).toMatch(
      /^Earlier note\n\[\d{4}-\d{2}-\d{2}T.*\] Follow-up needed$/,
    );
    expect(result.notes).toBe(updated.notes);
  });

  it('does not overwrite existing notes when submitted notes become empty after stripping', async () => {
    const called = makeEntry({
      status: QueueStatus.CALLED,
      notes: 'Earlier note',
    });
    const updated = makeEntry({
      ...called,
      status: QueueStatus.IN_CONSULTATION,
    });
    prisma.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.findFirst.mockResolvedValue(called);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(updated);
    prisma.queueEntry.count.mockResolvedValue(0);

    await service.updateEntryStatus(1, 10, {
      status: QueueStatus.IN_CONSULTATION,
      notes: '<p> </p>',
    });

    const updateData = tx.queueEntry.updateMany.mock.calls[0]?.[0]?.data as
      Record<string, unknown> | undefined;
    expect(updateData).not.toHaveProperty('notes');
  });

  it('does not allow notes when transitioning to CALLED', async () => {
    prisma.queueEntry.findFirst.mockResolvedValue(makeEntry());

    await expect(
      service.updateEntryStatus(1, 10, {
        status: QueueStatus.CALLED,
        notes: '',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        message: 'Notes are not allowed when status is CALLED.',
      },
      status: 400,
    });
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
  });

  it('requires call-next to transition a waiting entry to CALLED', async () => {
    prisma.queueEntry.findFirst.mockResolvedValue(makeEntry());

    await expect(
      service.updateEntryStatus(1, 10, { status: QueueStatus.CALLED }),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        message: 'Use call-next to transition a waiting entry to CALLED.',
      },
      status: 400,
    });
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
  });

  it('cancels a waiting entry and records cancelledAt', async () => {
    const waiting = makeEntry();
    const cancelled = makeEntry({
      ...waiting,
      status: QueueStatus.CANCELLED,
      cancelledAt: now,
    });
    prisma.queueEntry.findFirst.mockResolvedValue(waiting);
    tx.queueEntry.findFirst.mockResolvedValue(waiting);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(cancelled);
    prisma.queueEntry.count.mockResolvedValue(0);

    const result = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.CANCELLED,
    });

    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: objectContaining({
          status: QueueStatus.CANCELLED,
          cancelledAt: anyDate(),
        }),
      }),
    );
    expect(result.cancelled_at).toBe(now.toISOString());
  });

  it('completes only the current in-consultation ticket', async () => {
    const current = makeEntry({ status: QueueStatus.IN_CONSULTATION });
    const done = makeEntry({ ...current, status: QueueStatus.COMPLETED });
    prisma.queueEntry.findFirst.mockResolvedValue(current);
    tx.queueEntry.findFirst.mockResolvedValue(current);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue(done);
    prisma.queueEntry.count.mockResolvedValue(0);

    const result = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.COMPLETED,
    });

    const updateArgs = tx.queueEntry.updateMany.mock.calls[0]?.[0] as {
      where: { status: QueueStatus };
      data: { status: QueueStatus };
    };
    expect(updateArgs.where.status).toBe(QueueStatus.IN_CONSULTATION);
    expect(updateArgs.data.status).toBe(QueueStatus.COMPLETED);
    expect(result.status).toBe(QueueStatus.COMPLETED);
  });

  it('runs the complete WAITING to CALLED to IN_CONSULTATION to COMPLETED path', async () => {
    const waiting = makeEntry();
    const called = makeEntry({ ...waiting, status: QueueStatus.CALLED });
    const consulting = makeEntry({
      ...waiting,
      status: QueueStatus.IN_CONSULTATION,
      consultationStartedAt: now,
    });
    const completed = makeEntry({
      ...waiting,
      status: QueueStatus.COMPLETED,
      completedAt: now,
    });
    prisma.queueEntry.findFirst
      .mockResolvedValueOnce(waiting)
      .mockResolvedValueOnce(called)
      .mockResolvedValueOnce(consulting);
    tx.queueEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(called)
      .mockResolvedValueOnce(consulting);
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique
      .mockResolvedValueOnce(called)
      .mockResolvedValueOnce(consulting)
      .mockResolvedValueOnce(completed);
    prisma.queueEntry.count.mockResolvedValue(0);

    const callResult = await service.callNext(1, {
      room: 'Room 4',
      provider: 'Dr. Ana Santos',
    });
    const arrivalResult = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.IN_CONSULTATION,
    });
    const completionResult = await service.updateEntryStatus(1, 10, {
      status: QueueStatus.COMPLETED,
    });

    expect([
      callResult.status,
      arrivalResult.status,
      completionResult.status,
    ]).toEqual([
      QueueStatus.CALLED,
      QueueStatus.IN_CONSULTATION,
      QueueStatus.COMPLETED,
    ]);
    expect(tx.queueStatusHistory.create).toHaveBeenCalledTimes(3);
  });

  it('rejects starting consultation for a ticket that is not called', async () => {
    tx.queueEntry.findFirst.mockResolvedValue(makeEntry());
    await expect(
      service.updateEntryStatus(1, 10, {
        status: QueueStatus.IN_CONSULTATION,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_TRANSITION',
        currentStatus: QueueStatus.WAITING,
        requestedStatus: QueueStatus.IN_CONSULTATION,
        allowedNextStatuses: [QueueStatus.CALLED, QueueStatus.CANCELLED],
      },
      status: 409,
    });
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
    expect(prisma.queueStatusHistory.create).not.toHaveBeenCalled();
  });

  it('rejects any transition out of a terminal status with current and allowed statuses', async () => {
    tx.queueEntry.findFirst.mockResolvedValue(
      makeEntry({ status: QueueStatus.COMPLETED }),
    );

    await expect(
      service.updateEntryStatus(1, 10, { status: QueueStatus.CANCELLED }),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_TRANSITION',
        currentStatus: QueueStatus.COMPLETED,
        requestedStatus: QueueStatus.CANCELLED,
        allowedNextStatuses: [],
      },
      status: 409,
    });
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
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

  describe('Queue validity and duplicate entry rules (CQ-S4-4.2.03 & CQ-S4-4.3.02)', () => {
    it('rejects queue entry creation when target queue does not exist', async () => {
      prisma.dailyQueue.findUnique.mockResolvedValue(null);

      await expect(
        service.joinWalkIn(999, { name: 'Jane Doe' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects queue entry creation when queue is closed', async () => {
      prisma.dailyQueue.findUnique.mockResolvedValue({
        ...queue,
        isOpen: false,
      });

      await expect(service.joinWalkIn(1, { name: 'Jane Doe' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects queue entry creation when patient already has an active WAITING ticket', async () => {
      prisma.queueEntry.findFirst.mockResolvedValue(
        makeEntry({ patientId: 42, status: QueueStatus.WAITING }),
      );

      await expect(
        service.joinOnline(1, { name: 'Jane Doe', patientId: 42 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects queue entry creation when patient has a CALLED or IN_SERVICE ticket', async () => {
      prisma.queueEntry.findFirst.mockResolvedValue(
        makeEntry({ patientId: 42, status: QueueStatus.CALLED }),
      );

      await expect(
        service.joinOnline(1, { name: 'Jane Doe', patientId: 42 }),
      ).rejects.toThrow(ConflictException);
    });

    it('permits a new queue entry when patient previous ticket is in terminal state', async () => {
      prisma.queueEntry.findFirst.mockResolvedValue(null);
      tx.queueEntry.findFirst.mockResolvedValue(null);
      const created = makeEntry({
        id: 30,
        patientId: 42,
        status: QueueStatus.WAITING,
        createdAt: now,
      });
      tx.dailyQueue.update.mockResolvedValue({ ...queue, nextNumber: 3 });
      tx.queueEntry.create.mockResolvedValue(created);
      prisma.queueEntry.findMany.mockResolvedValue([created]);

      const result = await service.joinOnline(1, {
        name: 'Jane Doe',
        patientId: 42,
      });

      expect(result.status).toBe(QueueStatus.WAITING);
      expect(result.position_in_queue).toBe(1);
    });

    it('maps Prisma P2002 unique constraint conflict to DUPLICATE_ACTIVE_ENTRY', async () => {
      prisma.queueEntry.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      await expect(
        service.joinWalkIn(1, { name: 'Jane Doe', patientId: 42 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Queue metrics and status retrieval (CQ-S4-4.3.01)', () => {
    it('returns accurate queue metrics including breakdown and average wait time', async () => {
      const e1 = makeEntry({
        id: 1,
        source: QueueSource.WALK_IN,
        queueNumber: 1,
      });
      const e2 = makeEntry({
        id: 2,
        source: QueueSource.ONLINE,
        queueNumber: 2,
      });
      const e3 = makeEntry({
        id: 3,
        source: QueueSource.STAFF_GENERATED,
        queueNumber: 3,
      });

      prisma.queueEntry.findMany.mockImplementation((...args: unknown[]) => {
        const query = args[0] as { where: { status: QueueStatus } };
        if (query.where.status === QueueStatus.WAITING) {
          return Promise.resolve([e1, e2, e3]);
        }
        return Promise.resolve([]);
      });
      prisma.queueEntry.findFirst.mockResolvedValue(null);
      prisma.queueEntry.count.mockResolvedValue(5);

      const status = await service.getStaffQueueStatus(1);

      expect(status.total_waiting).toBe(3);
      expect(status.waiting_breakdown).toEqual({
        ONLINE: 1,
        WALK_IN: 1,
        STAFF_GENERATED: 1,
      });
      expect(status.total_completed_today).toBe(5);
      expect(status.avg_wait_time_minutes).toBe(30);
      expect(status.is_active).toBe(true);
      expect(status.last_updated).toBeDefined();
      expect(status.waiting_tickets[0]).toHaveProperty('patient_name');
      expect(status.waiting_tickets[0]).toHaveProperty('reason_for_visit');
      expect(prisma.queueEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dailyQueueId: 1, status: QueueStatus.WAITING },
          orderBy: [
            { createdAt: 'asc' },
            { queueNumber: 'asc' },
            { id: 'asc' },
          ],
        }),
      );
    });

    it('includes patient names and visit reasons in staff queue status only', async () => {
      const waiting = makeEntry({ id: 20, ticketNumber: 'A-020' });
      const inService = makeEntry({
        id: 21,
        ticketNumber: 'A-021',
        status: QueueStatus.IN_CONSULTATION,
        calledAt: now,
      });
      prisma.queueEntry.findMany.mockImplementation((...args: unknown[]) => {
        const query = args[0] as { where: { status: QueueStatus } };
        return Promise.resolve(
          query.where.status === QueueStatus.WAITING ? [waiting] : [],
        );
      });
      prisma.queueEntry.findFirst.mockResolvedValue(inService);
      prisma.queueEntry.count.mockResolvedValue(0);

      const status = await service.getStaffQueueStatus(1);

      expect(status.currently_serving).toMatchObject({
        patient_name: 'Ada Lovelace',
        reason_for_visit: 'private reason',
      });
      expect(status.waiting_tickets[0]).toMatchObject({
        patient_name: 'Ada Lovelace',
        reason_for_visit: 'private reason',
      });
    });

    it('returns zero wait time and null current serving for an empty queue', async () => {
      prisma.queueEntry.findMany.mockResolvedValue([]);
      prisma.queueEntry.findFirst.mockResolvedValue(null);
      prisma.queueEntry.count.mockResolvedValue(0);

      const status = await service.getQueueStatus(1);

      expect(status.total_waiting).toBe(0);
      expect(status.currently_serving).toBeNull();
      expect(status.avg_wait_time_minutes).toBe(0);
    });

    it('reports the called ticket and its persisted grace deadline as current', async () => {
      prisma.queueEntry.findMany.mockResolvedValue([]);
      const called = makeEntry({
        status: QueueStatus.CALLED,
        calledAt: now,
        graceExpiresAt: new Date(now.getTime() + 180_000),
      });
      prisma.queueEntry.findFirst.mockResolvedValue(called);

      const status = await service.getStaffQueueStatus(1);

      expect(status.currently_serving).toMatchObject({
        ticket_number: called.ticketNumber,
        status: QueueStatus.CALLED,
        called_at: now.toISOString(),
        grace_expires_at: new Date(now.getTime() + 180_000).toISOString(),
      });
      expect(status.grace_period_ms).toBe(180_000);
      expect(prisma.queueEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dailyQueueId: 1,
            status: {
              in: [QueueStatus.CALLED, QueueStatus.IN_CONSULTATION],
            },
          },
        }),
      );
    });

    it('reports the ticket currently in service', async () => {
      prisma.queueEntry.findMany.mockResolvedValue([]);
      const inService = makeEntry({
        id: 6,
        ticketNumber: 'A-006',
        status: QueueStatus.IN_CONSULTATION,
        updatedAt: now,
      });
      prisma.queueEntry.findFirst.mockResolvedValue(inService);

      const status = await service.getQueueStatus(1);

      expect(status.currently_serving?.ticket_number).toBe('A-006');
      expect(status.currently_serving?.status).toBe(
        QueueStatus.IN_CONSULTATION,
      );
    });
  });

  describe('Protect tracking token and patient-specific responses (CQ-S4-4.3.03)', () => {
    it('throws NotFoundException when tracking token does not exist', async () => {
      prisma.queueEntry.findFirst.mockResolvedValue(null);

      await expect(service.getTrackingStatus('trk_unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the active queue entry for an authenticated patient with position and wait estimate', async () => {
      const myEntry = makeEntry({
        id: 15,
        patientId: 88,
        ticketNumber: 'A-002',
        queueNumber: 2,
        status: QueueStatus.WAITING,
        roomNumber: 'Room 101',
      });
      const firstEntry = makeEntry({
        id: 10,
        patientId: 99,
        queueNumber: 1,
        status: QueueStatus.WAITING,
      });

      prisma.queueEntry.findFirst.mockResolvedValue(myEntry);
      prisma.queueEntry.findMany.mockImplementation((...args: unknown[]) => {
        const query = args[0] as { where: { status: QueueStatus } };
        if (query.where.status === QueueStatus.WAITING) {
          return Promise.resolve([firstEntry, myEntry]);
        }
        return Promise.resolve([]);
      });

      const res = await service.getMyQueueEntry(1, 88);

      expect(res).toEqual({
        queue_entry_id: 15,
        queue_id: 1,
        ticket_number: 'A-002',
        position_in_queue: 2,
        estimated_wait_minutes: 15,
        status: QueueStatus.WAITING,
        room_number: 'Room 101',
        joined_at: now.toISOString(),
        called_at: null,
        grace_expires_at: null,
      });
    });

    it('returns null when authenticated patient has no active queue entry', async () => {
      prisma.queueEntry.findFirst.mockResolvedValue(null);

      const res = await service.getMyQueueEntry(1, 88);

      expect(res).toBeNull();
    });

    it('rejects getMyQueueEntry when the queue session does not exist', async () => {
      prisma.dailyQueue.findUnique.mockResolvedValue(null);

      await expect(service.getMyQueueEntry(999, 88)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

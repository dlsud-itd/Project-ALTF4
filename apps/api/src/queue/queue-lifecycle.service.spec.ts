import { AppointmentStatus, Prisma, QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueLifecycleService } from './queue-lifecycle.service';

const objectContaining = (sample: Record<string, unknown>): unknown =>
  expect.objectContaining(sample);

describe('QueueLifecycleService', () => {
  const tx = {
    queueEntry: {
      findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      updateMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    appointment: {
      findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      updateMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
    queueStatusHistory: {
      create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    },
  };
  const prisma = {
    $transaction: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  };
  const transactionClient = tx as unknown as Prisma.TransactionClient;
  let service: QueueLifecycleService;

  beforeEach(() => {
    Object.values(tx.queueEntry).forEach((mock) => mock.mockReset());
    Object.values(tx.appointment).forEach((mock) => mock.mockReset());
    tx.queueStatusHistory.create.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (...args: unknown[]) => {
      const callback = args[0] as (
        transaction: Prisma.TransactionClient,
      ) => Promise<unknown>;
      return callback(transactionClient);
    });
    tx.queueEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.queueStatusHistory.create.mockResolvedValue({ id: 1 });
    service = new QueueLifecycleService(prisma as unknown as PrismaService);
  });

  it('completes a linked appointment in the same transaction as its queue entry', async () => {
    tx.queueEntry.findFirst.mockResolvedValue({
      id: 12,
      status: QueueStatus.IN_CONSULTATION,
      notes: null,
      appointmentId: 31,
    });
    tx.appointment.findUnique.mockResolvedValue({
      status: AppointmentStatus.BOOKED,
    });
    tx.appointment.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findUnique.mockResolvedValue({
      id: 12,
      ticketNumber: 'A-012',
      status: QueueStatus.COMPLETED,
      completedAt: new Date('2026-11-06T09:00:00.000Z'),
    });

    await service.transitionEntry(transactionClient, {
      queueId: 4,
      entryId: 12,
      requestedStatus: QueueStatus.COMPLETED,
      now: new Date('2026-11-06T09:00:00.000Z'),
    });

    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 31, status: AppointmentStatus.BOOKED },
      data: { status: AppointmentStatus.COMPLETED },
    });
    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          status: QueueStatus.COMPLETED,
          completedAt: new Date('2026-11-06T09:00:00.000Z'),
        }),
      }),
    );
    expect(tx.queueStatusHistory.create).toHaveBeenCalledWith({
      data: { queueEntryId: 12, status: QueueStatus.COMPLETED },
    });
  });

  it('cancels only the appointment-linked queue entry and records its timestamp', async () => {
    tx.appointment.findUnique.mockResolvedValue({
      id: 31,
      status: AppointmentStatus.BOOKED,
    });
    tx.appointment.updateMany.mockResolvedValue({ count: 1 });
    tx.queueEntry.findMany.mockResolvedValue([
      {
        id: 12,
        dailyQueueId: 4,
        ticketNumber: 'A-012',
        status: QueueStatus.WAITING,
      },
    ]);
    tx.queueEntry.findFirst.mockResolvedValue({
      id: 12,
      status: QueueStatus.WAITING,
      notes: null,
      appointmentId: 31,
    });
    tx.queueEntry.findUnique.mockResolvedValue({
      id: 12,
      ticketNumber: 'A-012',
      status: QueueStatus.CANCELLED,
    });

    const cancelled = await service.cancelAppointment(
      31,
      new Date('2026-11-06T09:10:00.000Z'),
    );

    expect(cancelled).toEqual([
      {
        id: 12,
        dailyQueueId: 4,
        ticketNumber: 'A-012',
        status: QueueStatus.CANCELLED,
      },
    ]);
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 31, status: AppointmentStatus.BOOKED },
      data: { status: AppointmentStatus.CANCELLED },
    });
    expect(tx.queueEntry.updateMany).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          status: QueueStatus.CANCELLED,
          cancelledAt: new Date('2026-11-06T09:10:00.000Z'),
        }),
      }),
    );
  });

  it('rejects invalid current-state transitions before writing', async () => {
    tx.queueEntry.findFirst.mockResolvedValue({
      id: 12,
      status: QueueStatus.WAITING,
      notes: null,
      appointmentId: null,
    });

    await expect(
      service.transitionEntry(transactionClient, {
        queueId: 4,
        entryId: 12,
        requestedStatus: QueueStatus.COMPLETED,
        now: new Date(),
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_TRANSITION',
        currentStatus: QueueStatus.WAITING,
      },
      status: 409,
    });
    expect(tx.queueEntry.updateMany).not.toHaveBeenCalled();
    expect(tx.appointment.updateMany).not.toHaveBeenCalled();
  });
});

import { QueueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueEventsService } from './queue-events.service';
import { QueueLifecycleService } from './queue-lifecycle.service';
import { QueueReadService } from './queue-read.service';

describe('QueueReadService patient response', () => {
  it('omits staff metrics, provider details, and private notes', async () => {
    const currentServing = {
      id: 8,
      ticketNumber: 'A-008',
      status: QueueStatus.CALLED,
      calledAt: new Date('2026-11-06T09:00:00.000Z'),
      graceExpiresAt: new Date('2026-11-06T09:03:00.000Z'),
      roomNumber: 'Counter 1',
      provider: 'Staff-only provider',
      firstName: 'Patient Name',
      lastName: null,
      reasonForVisit: 'Private reason',
      notes: 'Private consultation note',
    };
    const prisma = {
      dailyQueue: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          clinicDate: new Date('2026-11-06T00:00:00.000Z'),
          isOpen: true,
          fallbackServiceMinutes: 15,
        }),
      },
      queueEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(currentServing),
        count: jest.fn(),
      },
    };
    const events = new QueueEventsService();
    const lifecycle = new QueueLifecycleService(
      prisma as unknown as PrismaService,
    );
    const service = new QueueReadService(
      prisma as unknown as PrismaService,
      events,
      lifecycle,
    );

    const response = await service.getQueueStatus(4);
    const serving = response.currently_serving;

    expect(serving).toMatchObject({
      ticket_number: 'A-008',
      status: QueueStatus.CALLED,
      room_number: 'Counter 1',
    });
    expect(serving).not.toHaveProperty('provider');
    expect(serving).not.toHaveProperty('grace_expires_at');
    expect(serving).not.toHaveProperty('patient_name');
    expect(serving).not.toHaveProperty('reason_for_visit');
    expect(serving).not.toHaveProperty('notes');
    expect(response).not.toHaveProperty('waiting_breakdown');
    expect(response).not.toHaveProperty('total_completed_today');
    expect(response).not.toHaveProperty('total_no_shows_today');
    expect(prisma.queueEntry.count).not.toHaveBeenCalled();
  });

  it('estimates queue position and wait from active tickets and completed durations', async () => {
    const prisma = {
      queueEntry: {
        findUnique: jest.fn().mockResolvedValue({ queueNumber: 8 }),
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          {
            consultationStartedAt: new Date('2026-11-06T09:00:00.000Z'),
            completedAt: new Date('2026-11-06T09:12:30.000Z'),
          },
        ]),
      },
    };
    const service = new QueueReadService(
      prisma as unknown as PrismaService,
      new QueueEventsService(),
      new QueueLifecycleService(prisma as unknown as PrismaService),
    );

    await expect(
      service.getQueuePositionAndWait(4, { fallbackServiceMinutes: 15 }, 12),
    ).resolves.toEqual({ position: 3, estimatedWaitMinutes: 26 });
    expect(prisma.queueEntry.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dailyQueueId: 4,
          status: {
            in: [
              QueueStatus.WAITING,
              QueueStatus.CALLED,
              QueueStatus.IN_CONSULTATION,
            ],
          },
          queueNumber: { lt: 8 },
        }),
      }),
    );
  });
});

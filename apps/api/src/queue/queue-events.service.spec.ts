import { QueueEventsService } from './queue-events.service';

describe('QueueEventsService public payloads', () => {
  it('strips staff and administrative fields from queue events', () => {
    const service = new QueueEventsService();
    const events: unknown[] = [];
    const subscription = service
      .getQueueEvents(4)
      .subscribe((event) => events.push(event.data));

    service.emit(4, 'queue:called', {
      queueId: 4,
      queueEntryId: 12,
      ticketNumber: 'A-012',
      roomNumber: 'Counter 1',
      provider: 'Staff-only provider',
      calledAt: '2026-11-06T09:00:00.000Z',
      graceExpiresAt: '2026-11-06T09:03:00.000Z',
      notes: 'Private consultation note',
    });

    expect(events).toEqual([
      {
        ticketNumber: 'A-012',
        roomNumber: 'Counter 1',
        calledAt: '2026-11-06T09:00:00.000Z',
      },
    ]);
    subscription.unsubscribe();
  });
});

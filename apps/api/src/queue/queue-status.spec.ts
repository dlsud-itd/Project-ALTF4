import { QueueStatus } from '@prisma/client';
import {
  QUEUE_STATUS_TRANSITIONS,
  isQueueStatusTransitionAllowed,
} from './queue-status';

describe('Queue status transitions', () => {
  it('defines every allowed and disallowed transition from the canonical statuses', () => {
    const expected: Record<QueueStatus, readonly QueueStatus[]> = {
      [QueueStatus.WAITING]: [QueueStatus.CALLED, QueueStatus.CANCELLED],
      [QueueStatus.CALLED]: [
        QueueStatus.IN_CONSULTATION,
        QueueStatus.NO_SHOW,
        QueueStatus.CANCELLED,
      ],
      [QueueStatus.IN_CONSULTATION]: [
        QueueStatus.COMPLETED,
        QueueStatus.CANCELLED,
      ],
      [QueueStatus.COMPLETED]: [],
      [QueueStatus.NO_SHOW]: [],
      [QueueStatus.CANCELLED]: [],
    };

    expect(QUEUE_STATUS_TRANSITIONS).toEqual(expected);
    for (const currentStatus of Object.values(QueueStatus)) {
      for (const requestedStatus of Object.values(QueueStatus)) {
        expect(
          isQueueStatusTransitionAllowed(currentStatus, requestedStatus),
        ).toBe(expected[currentStatus].includes(requestedStatus));
      }
    }
  });
});

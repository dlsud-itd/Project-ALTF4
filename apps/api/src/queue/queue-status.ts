import { QueueStatus } from '@prisma/client';

export const QUEUE_STATUS_TRANSITIONS: Record<
  QueueStatus,
  readonly QueueStatus[]
> = {
  [QueueStatus.WAITING]: [QueueStatus.CALLED, QueueStatus.CANCELLED],
  [QueueStatus.CALLED]: [
    QueueStatus.IN_CONSULTATION,
    QueueStatus.NO_SHOW,
    QueueStatus.CANCELLED,
  ],
  [QueueStatus.IN_CONSULTATION]: [QueueStatus.COMPLETED, QueueStatus.CANCELLED],
  [QueueStatus.COMPLETED]: [],
  [QueueStatus.NO_SHOW]: [],
  [QueueStatus.CANCELLED]: [],
};

export function isQueueStatusTransitionAllowed(
  currentStatus: QueueStatus,
  requestedStatus: QueueStatus,
): boolean {
  return QUEUE_STATUS_TRANSITIONS[currentStatus].includes(requestedStatus);
}

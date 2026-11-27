import {
  DEFAULT_SERVICE_DURATION_MINUTES,
  MILLISECONDS_PER_MINUTE,
} from './clinic.constants';
import { QueueStatus } from '@prisma/client';

// A day needs this many finished consultations before its average is trusted.
export const MIN_SAMPLES_FOR_AVERAGE = 3;

export type CompletedServiceDuration = {
  consultationStartedAt: Date | null;
  completedAt: Date | null;
};

// Stage timestamps let an in-progress entry be charged only for time still owed.
export type QueueEntryForEstimate = {
  status: QueueStatus;
  calledAt: Date | null;
  consultationStartedAt: Date | null;
};

export function getAverageServiceDurationMinutes(
  completedTickets: readonly CompletedServiceDuration[],
  fallbackMinutes: number = DEFAULT_SERVICE_DURATION_MINUTES,
): number | null {
  const durations = completedTickets.flatMap((ticket) => {
    if (!ticket.consultationStartedAt || !ticket.completedAt) {
      return [];
    }

    const duration =
      ticket.completedAt.getTime() - ticket.consultationStartedAt.getTime();
    return duration > 0 ? [duration] : [];
  });

  if (durations.length < MIN_SAMPLES_FOR_AVERAGE) {
    return fallbackMinutes > 0 ? fallbackMinutes : null;
  }

  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
  return Math.ceil(totalDuration / durations.length / MILLISECONDS_PER_MINUTE);
}

export function estimateQueueWaitMinutes(
  ticketsAhead: number,
  serviceDurationMinutes: number,
): number {
  return Math.max(0, ticketsAhead) * Math.max(0, serviceDurationMinutes);
}

// A consultation that has run past the average owes nothing, so it stops
// blocking the queue.
const remainingMinutes = (
  startedAt: Date | null,
  averageMinutes: number,
  now: Date,
): number => {
  if (!startedAt) {
    return averageMinutes;
  }
  const elapsed = Math.floor(
    (now.getTime() - startedAt.getTime()) / MILLISECONDS_PER_MINUTE,
  );
  return Math.max(0, averageMinutes - Math.max(0, elapsed));
};

/**
 * Waits the queue owes a patient. In-progress entries are charged only for the
 * time they have left, so the estimate decays as a consultation runs.
 *
 * Returns null while the day has too few samples to average.
 */
export function estimateWaitFromQueue(
  entriesAhead: readonly QueueEntryForEstimate[],
  averageMinutes: number | null,
  now: Date = new Date(),
): number | null {
  if (averageMinutes === null) {
    return null;
  }

  let total = 0;
  for (const entry of entriesAhead) {
    switch (entry.status) {
      case QueueStatus.IN_CONSULTATION:
        total += remainingMinutes(
          entry.consultationStartedAt,
          averageMinutes,
          now,
        );
        break;
      case QueueStatus.CALLED:
        total += remainingMinutes(entry.calledAt, averageMinutes, now);
        break;
      case QueueStatus.WAITING:
        total += averageMinutes;
        break;
      default:
        break;
    }
  }

  return total;
}

// Reports a queue that has run past its average so the UI can explain a zero wait.
export const isQueueRunningLate = (
  entriesAhead: readonly QueueEntryForEstimate[],
  averageMinutes: number | null,
  now: Date = new Date(),
): boolean => {
  if (averageMinutes === null) {
    return false;
  }
  const isSomeoneServing = entriesAhead.some(
    (entry) =>
      entry.status === QueueStatus.IN_CONSULTATION ||
      entry.status === QueueStatus.CALLED,
  );
  return (
    isSomeoneServing &&
    estimateWaitFromQueue(entriesAhead, averageMinutes, now) === 0
  );
};


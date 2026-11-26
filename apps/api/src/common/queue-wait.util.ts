import {
  DEFAULT_SERVICE_DURATION_MINUTES,
  MILLISECONDS_PER_MINUTE,
} from './clinic.constants';

export type CompletedServiceDuration = {
  consultationStartedAt: Date | null;
  completedAt: Date | null;
};

export function getAverageServiceDurationMinutes(
  completedTickets: readonly CompletedServiceDuration[],
  fallbackMinutes = DEFAULT_SERVICE_DURATION_MINUTES,
): number {
  const durations = completedTickets.flatMap((ticket) => {
    if (!ticket.consultationStartedAt || !ticket.completedAt) {
      return [];
    }

    const duration =
      ticket.completedAt.getTime() - ticket.consultationStartedAt.getTime();
    return duration > 0 ? [duration] : [];
  });

  if (durations.length === 0) {
    return fallbackMinutes;
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

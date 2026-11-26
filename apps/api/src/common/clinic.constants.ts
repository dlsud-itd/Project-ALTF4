import { AppointmentStatus, QueueStatus } from '@prisma/client';

export const MAX_ACTIVE_BOOKINGS = 3;
export const DEFAULT_SERVICE_DURATION_MINUTES = 15;
export const MILLISECONDS_PER_MINUTE = 60_000;

export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.BOOKED,
];

export const ACTIVE_QUEUE_STATUSES: readonly QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_CONSULTATION,
];

import { AppointmentStatus, QueueStatus } from '@prisma/client';

export const MAX_ACTIVE_BOOKINGS = 3;
export const DEFAULT_SERVICE_DURATION_MINUTES = 15;
export const MILLISECONDS_PER_MINUTE = 60_000;
export const MILLISECONDS_PER_SECOND = 1_000;

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;
export const PASSWORD_NON_WHITESPACE_REGEX = /\S/;

export const PASSWORD_RESET_OTP_LENGTH = 6;
export const PASSWORD_RESET_OTP_REGEX = /^\d{6}$/;
export const PASSWORD_RESET_DEFAULT_EXPIRY_MINUTES = 5;
export const PASSWORD_RESET_DEFAULT_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 10;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 15 * MILLISECONDS_PER_MINUTE;
export const PASSWORD_RESET_MAX_REQUESTS_PER_EMAIL = 5;
export const PASSWORD_RESET_MAX_REQUESTS_PER_IP = 10;

export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.BOOKED,
];

export const ACTIVE_QUEUE_STATUSES: readonly QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_CONSULTATION,
];

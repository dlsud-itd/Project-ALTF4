import { QueueStatus } from '../models';
import { AppointmentStatus } from '../models/appointment.models';

export const PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS = 15_000;

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;
export const PASSWORD_RESET_OTP_LENGTH = 6;
export const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 60;

export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'BOOKED',
];

export const ACTIVE_QUEUE_STATUSES: readonly QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_CONSULTATION,
];

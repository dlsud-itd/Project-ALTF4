import { AppointmentStatus } from '@prisma/client';

export const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  [AppointmentStatus.BOOKED]: [
    AppointmentStatus.CANCELLED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

export function isAppointmentStatusTransitionAllowed(
  currentStatus: AppointmentStatus,
  requestedStatus: AppointmentStatus,
): boolean {
  return APPOINTMENT_STATUS_TRANSITIONS[currentStatus].includes(
    requestedStatus,
  );
}

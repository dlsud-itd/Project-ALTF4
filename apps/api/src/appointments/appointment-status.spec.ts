import { AppointmentStatus } from '@prisma/client';
import {
  APPOINTMENT_STATUS_TRANSITIONS,
  isAppointmentStatusTransitionAllowed,
} from './appointment-status';

describe('Appointment status transitions', () => {
  it('only allows booked appointments to reach a terminal state', () => {
    expect(APPOINTMENT_STATUS_TRANSITIONS).toEqual({
      [AppointmentStatus.BOOKED]: [
        AppointmentStatus.CANCELLED,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.CANCELLED]: [],
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.NO_SHOW]: [],
    });

    expect(
      isAppointmentStatusTransitionAllowed(
        AppointmentStatus.BOOKED,
        AppointmentStatus.COMPLETED,
      ),
    ).toBe(true);
    expect(
      isAppointmentStatusTransitionAllowed(
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
      ),
    ).toBe(false);
  });
});

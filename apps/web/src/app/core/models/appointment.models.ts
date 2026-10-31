import { ClinicSlot } from './slot.models';

export type AppointmentStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type PatientAppointment = {
  id: number;
  status: AppointmentStatus;
  createdAt: string;
  slot: ClinicSlot;
};

export type AppointmentsResponse = {
  appointments: PatientAppointment[];
};

export type CreateAppointmentRequest = {
  slotId: number;
  reasonForVisit?: string;
};

export type AppointmentBookingResponse = {
  message: string;
  appointment: PatientAppointment;
};

export type AppointmentMutationResponse = {
  message: string;
};


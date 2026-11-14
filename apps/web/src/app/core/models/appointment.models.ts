import { ClinicSlot } from './slot.models';

export type AppointmentStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type ReservedQueueEntry = {
  ticketNumber: string;
  queueNumber: number;
  positionInQueue: number;
  estimatedWaitMinutes: number;
};

export type PatientAppointment = {
  id: number;
  status: AppointmentStatus;
  createdAt: string;
  slot: ClinicSlot;
  reservedQueueEntry?: ReservedQueueEntry | null;
};

export type StaffAppointment = PatientAppointment & {
  patient: {
    id: number;
    fullName: string;
    affiliation: string;
  };
};

export type StaffAppointmentsResponse = {
  appointments: StaffAppointment[];
};

export type AppointmentsResponse = {
  appointments: PatientAppointment[];
};

export type CreateAppointmentRequest = {
  slotId: number;
  reasonForVisit?: string;
};

export type RescheduleAppointmentRequest = {
  slotId: number;
};

export type AppointmentBookingResponse = {
  message: string;
  appointment: PatientAppointment;
};

export type AppointmentMutationResponse = {
  message: string;
};


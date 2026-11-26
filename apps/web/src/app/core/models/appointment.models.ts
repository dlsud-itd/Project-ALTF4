import { ClinicSlot } from './slot.models';
import { QueueStatus } from './queue.models';

export type AppointmentStatus =
  'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type ReservedQueueEntry = {
  id?: number;
  ticketNumber: string;
  queueNumber: number;
  status?: QueueStatus;
  positionInQueue: number;
  estimatedWaitMinutes: number;
  roomNumber?: string | null;
};

export type PatientAppointment = {
  id: number;
  status: AppointmentStatus;
  createdAt: string;
  archived?: boolean;
  slot: ClinicSlot;
  reservedQueueEntry?: ReservedQueueEntry | null;
  reservedQueueEntries?: ReservedQueueEntry[];
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
  activeBookingCount: number;
  maxActiveBookings: number;
};

export type CreateAppointmentRequest = {
  slotId: number;
  reasonForVisit: string;
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

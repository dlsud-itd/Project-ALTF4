export enum QueueStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  IN_SERVICE = 'IN_SERVICE',
  DONE = 'DONE',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export type ServingTicket = {
  queue_entry_id: number;
  ticket_number: string;
  status: QueueStatus;
  called_at: string | null;
  grace_expires_at: string | null;
  room_number: string;
};

export type QueueStatusResponse = {
  queue_id: number;
  clinic_date: string;
  is_active: boolean;
  currently_serving: ServingTicket | null;
  total_waiting: number;
  waiting_tickets: QueueTicketSummary[];
  total_completed_today: number;
  avg_wait_time_minutes: number;
  server_time: string;
  last_updated: string;
};

export type QueueTicketSummary = {
  queue_entry_id: number;
  ticket_number: string;
  status: QueueStatus;
};

export type WalkInRequest = {
  name: string;
  patientId?: number;
  reasonForVisit?: string;
};

export type WalkInResponse = {
  queue_entry_id: number;
  queue_id: number;
  ticket_number: string;
  position_in_queue: number;
  estimated_wait_minutes: number;
  status: QueueStatus;
  tracking_token?: string;
  joined_at: string;
};

export type CallNextRequest = {
  roomNumber: string;
  practitionerId: string;
};

export type CallNextResponse = {
  queue_entry_id: number;
  ticket_number: string;
  patient_name: string;
  status: QueueStatus;
  called_at: string;
  grace_expires_at: string;
  room_number: string;
};

export type UpdateEntryStatusRequest = {
  status: QueueStatus;
  notes?: string;
};

export type UpdateEntryStatusResponse = {
  queue_entry_id: number;
  queue_id: number;
  ticket_number: string;
  status: QueueStatus;
  updated_at: string;
  notes?: string;
};

export type TrackingStatusResponse = {
  ticket_number: string;
  status: QueueStatus;
  position_in_queue: number;
  time_remaining_seconds?: number;
};

export type PatientQueueEntryResponse = {
  queue_entry_id: number;
  queue_id: number;
  ticket_number: string;
  position_in_queue: number;
  estimated_wait_minutes: number;
  status: QueueStatus;
  room_number?: string | null;
  joined_at: string;
  called_at?: string | null;
  grace_expires_at?: string | null;
};

export type WebSocketConnectionStatus = {
  connected: boolean;
  socketId?: string;
  timestamp: string;
};

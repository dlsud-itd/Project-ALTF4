export enum QueueStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  IN_SERVICE = 'IN_SERVICE',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum QueuePriority {
  NORMAL = 'NORMAL',
  EMERGENCY = 'EMERGENCY',
}

export type ServingTicket = {
  ticket_number: string;
  called_at: string | null;
  room_number: string;
};

export type QueueStatusResponse = {
  queue_id: number;
  clinic_date: string;
  is_active: boolean;
  currently_serving: ServingTicket | null;
  total_waiting: number;
  total_completed_today: number;
  avg_wait_time_minutes: number;
  last_updated: string;
};

export type WalkInRequest = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  reasonForVisit?: string;
  priority?: QueuePriority;
};

export type WalkInResponse = {
  queue_entry_id: number;
  queue_id: number;
  ticket_number: string;
  position_in_queue: number;
  estimated_wait_minutes: number;
  status: QueueStatus;
  priority: QueuePriority;
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

export type WebSocketConnectionStatus = {
  connected: boolean;
  socketId?: string;
  timestamp: string;
};

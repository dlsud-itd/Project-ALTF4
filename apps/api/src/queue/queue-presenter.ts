import { QueueStatus } from '@prisma/client';

type QueueTicket = {
  id: number;
  ticketNumber: string;
  status: QueueStatus;
  firstName?: string | null;
  lastName?: string | null;
  reasonForVisit?: string | null;
};

type ServingQueueTicket = QueueTicket & {
  calledAt: Date | null;
  graceExpiresAt: Date | null;
  roomNumber: string | null;
  provider: string | null;
};

export function presentWaitingTicket(
  entry: QueueTicket,
  includePatientDetails: boolean,
) {
  return {
    queue_entry_id: entry.id,
    ticket_number: entry.ticketNumber,
    status: entry.status,
    ...(includePatientDetails
      ? {
          patient_name:
            `${entry.firstName || ''} ${entry.lastName || ''}`.trim() || null,
          reason_for_visit: entry.reasonForVisit || null,
        }
      : {}),
  };
}

export function presentServingTicket(
  entry: ServingQueueTicket | null,
  includePatientDetails: boolean,
) {
  if (!entry) {
    return null;
  }

  return {
    ticket_number: entry.ticketNumber,
    queue_entry_id: entry.id,
    status: entry.status,
    called_at: entry.calledAt?.toISOString() || null,
    room_number: entry.roomNumber || 'Counter 1',
    ...(includePatientDetails
      ? {
          grace_expires_at: entry.graceExpiresAt?.toISOString() || null,
          provider: entry.provider,
          patient_name:
            `${entry.firstName || ''} ${entry.lastName || ''}`.trim() || null,
          reason_for_visit: entry.reasonForVisit || null,
        }
      : {}),
  };
}

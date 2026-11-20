export type NotificationType =
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_CANCELLATION'
  | 'BOOKING_RESCHEDULE'
  | 'QUEUE_STATUS_UPDATE'
  | 'APPROACHING_TURN'
  | 'QUEUE_CALL'
  | 'APPOINTMENT_REMINDER'
  | 'GENERAL';

export type PatientNotification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  appointmentId: number | null;
  queueEntryId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsListResponse = {
  notifications: PatientNotification[];
  unreadCount: number;
  totalCount: number;
  page: number;
  limit: number;
};

export type MarkAllNotificationsReadResponse = {
  updatedCount: number;
};

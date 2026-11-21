import { NotificationType, QueueStatus } from '@prisma/client';

export enum NotificationRecipientRole {
  PATIENT = 'PATIENT',
  STAFF = 'STAFF',
}

export interface AppointmentNotificationContext {
  appointmentId: number;
  appointmentDate: string;
  appointmentTime: string;
}

export interface QueueNotificationContext {
  queueEntryId: number;
  ticketNumber: string;
  status: QueueStatus;
}

export interface ApproachingTurnContext {
  queueEntryId: number;
  ticketNumber: string;
}

export interface NotificationContextByType {
  [NotificationType.BOOKING_CONFIRMATION]: AppointmentNotificationContext;
  [NotificationType.BOOKING_CANCELLATION]: AppointmentNotificationContext;
  [NotificationType.BOOKING_RESCHEDULE]: AppointmentNotificationContext;
  [NotificationType.QUEUE_STATUS_UPDATE]: QueueNotificationContext;
  [NotificationType.APPROACHING_TURN]: ApproachingTurnContext;
}

type NotificationEventType = keyof NotificationContextByType;

export type NotificationEvent = {
  [Type in NotificationEventType]: {
    type: Type;
    context: NotificationContextByType[Type];
  };
}[NotificationEventType];

export interface NotificationReferenceFields {
  appointmentId?: number;
  queueEntryId?: number;
}

export interface NotificationPayload extends NotificationReferenceFields {
  type: NotificationType;
  title: string;
  message: string;
}

export interface NotificationEventRule<Type extends NotificationEventType> {
  recipients: readonly NotificationRecipientRole[];
  referenceFields: readonly (keyof NotificationReferenceFields)[];
  title: string;
  message: (context: NotificationContextByType[Type]) => string;
  references: (
    context: NotificationContextByType[Type],
  ) => NotificationReferenceFields;
}

export const NOTIFICATION_EVENT_RULES: {
  [Type in NotificationEventType]: NotificationEventRule<Type>;
} = {
  [NotificationType.BOOKING_CONFIRMATION]: {
    recipients: [NotificationRecipientRole.PATIENT],
    referenceFields: ['appointmentId'],
    title: 'Booking confirmed',
    message: ({ appointmentDate, appointmentTime }) =>
      `Your appointment is confirmed for ${appointmentDate} at ${appointmentTime}.`,
    references: ({ appointmentId }) => ({ appointmentId }),
  },
  [NotificationType.BOOKING_CANCELLATION]: {
    recipients: [
      NotificationRecipientRole.PATIENT,
      NotificationRecipientRole.STAFF,
    ],
    referenceFields: ['appointmentId'],
    title: 'Booking cancelled',
    message: ({ appointmentDate, appointmentTime }) =>
      `The appointment scheduled for ${appointmentDate} at ${appointmentTime} was cancelled.`,
    references: ({ appointmentId }) => ({ appointmentId }),
  },
  [NotificationType.BOOKING_RESCHEDULE]: {
    recipients: [
      NotificationRecipientRole.PATIENT,
      NotificationRecipientRole.STAFF,
    ],
    referenceFields: ['appointmentId'],
    title: 'Booking rescheduled',
    message: ({ appointmentDate, appointmentTime }) =>
      `Appointment rescheduled to ${appointmentDate} at ${appointmentTime}.`,
    references: ({ appointmentId }) => ({ appointmentId }),
  },
  [NotificationType.QUEUE_STATUS_UPDATE]: {
    recipients: [NotificationRecipientRole.PATIENT],
    referenceFields: ['queueEntryId'],
    title: 'Queue status updated',
    message: ({ ticketNumber, status }) =>
      `Ticket ${ticketNumber} status: ${status}.`,
    references: ({ queueEntryId }) => ({ queueEntryId }),
  },
  [NotificationType.APPROACHING_TURN]: {
    recipients: [NotificationRecipientRole.PATIENT],
    referenceFields: ['queueEntryId'],
    title: 'Your turn is approaching',
    message: ({ ticketNumber }) =>
      `Ticket ${ticketNumber} is approaching its turn.`,
    references: ({ queueEntryId }) => ({ queueEntryId }),
  },
};

function buildPayloadForEvent<Type extends NotificationEventType>(
  event: {
    type: Type;
    context: NotificationContextByType[Type];
  },
  rule: NotificationEventRule<Type>,
): NotificationPayload {
  return {
    type: event.type,
    title: rule.title,
    message: rule.message(event.context),
    ...rule.references(event.context),
  };
}

export function buildNotificationPayload(
  event: NotificationEvent,
): NotificationPayload {
  switch (event.type) {
    case NotificationType.BOOKING_CONFIRMATION:
    case NotificationType.BOOKING_CANCELLATION:
    case NotificationType.BOOKING_RESCHEDULE:
      return buildPayloadForEvent(event, NOTIFICATION_EVENT_RULES[event.type]);
    case NotificationType.QUEUE_STATUS_UPDATE:
    case NotificationType.APPROACHING_TURN:
      return buildPayloadForEvent(event, NOTIFICATION_EVENT_RULES[event.type]);
    default: {
      const unreachableEvent: never = event;
      return unreachableEvent;
    }
  }
}

import { computed, Injectable, signal } from '@angular/core';

export type NotificationTagSeverity = 'info' | 'warn' | 'secondary';
export type NotificationType =
  | 'QUEUE_CALL'
  | 'APPOINTMENT_REMINDER'
  | 'GENERAL';

// Mirrors the Prisma Notification model (ids and dates as the API will
// send them). TODO(Lim, Jereign): move to core/models once the API exists.
export interface PatientNotification {
  id: number;
  type: NotificationType;
  message: string;
  appointmentId: number | null;
  queueEntryId: number | null;
  createdAt: string;
  readAt: string | null;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  QUEUE_CALL: 'Queue call',
  APPOINTMENT_REMINDER: 'Reminder',
  GENERAL: 'General',
};

const TYPE_SEVERITIES: Record<NotificationType, NotificationTagSeverity> = {
  QUEUE_CALL: 'warn',
  APPOINTMENT_REMINDER: 'info',
  GENERAL: 'secondary',
};

// TODO(Lim, Jereign): replace with deep links (appointment or queue entry)
// once the API exposes the ids for the patient.
const TYPE_ROUTES: Record<NotificationType, string | null> = {
  QUEUE_CALL: '/patient/queue',
  APPOINTMENT_REMINDER: '/patient/bookings',
  GENERAL: null,
};

const TYPE_LINK_LABELS: Record<NotificationType, string> = {
  QUEUE_CALL: 'View queue',
  APPOINTMENT_REMINDER: 'View bookings',
  GENERAL: '',
};

export const notificationTypeLabel = (type: NotificationType): string =>
  TYPE_LABELS[type];

export const notificationTypeSeverity = (
  type: NotificationType,
): NotificationTagSeverity => TYPE_SEVERITIES[type];

export const notificationRoute = (type: NotificationType): string | null =>
  TYPE_ROUTES[type];

export const notificationLinkLabel = (type: NotificationType): string =>
  TYPE_LINK_LABELS[type];

// Sample data only. TODO(Lim, Jereign): replace with the notifications API.
export const SAMPLE_NOTIFICATIONS: readonly PatientNotification[] = [
  {
    id: 5,
    type: 'QUEUE_CALL',
    message: 'Your number was called. Please proceed to Station 2.',
    appointmentId: null,
    queueEntryId: 41,
    createdAt: '2026-11-19T09:42:00',
    readAt: null,
  },
  {
    id: 4,
    type: 'APPOINTMENT_REMINDER',
    message: 'Reminder: your appointment is tomorrow at 10:30 AM.',
    appointmentId: 18,
    queueEntryId: null,
    createdAt: '2026-11-19T08:00:00',
    readAt: null,
  },
  {
    id: 3,
    type: 'GENERAL',
    message: 'The clinic will close early on Friday at 3:00 PM.',
    appointmentId: null,
    queueEntryId: null,
    createdAt: '2026-11-18T16:15:00',
    readAt: null,
  },
  {
    id: 2,
    type: 'APPOINTMENT_REMINDER',
    message: 'Your appointment on November 12 was confirmed.',
    appointmentId: 12,
    queueEntryId: null,
    createdAt: '2026-11-11T13:05:00',
    readAt: '2026-11-11T14:00:00',
  },
  {
    id: 1,
    type: 'QUEUE_CALL',
    message: 'You were called to Station 1 and marked as served.',
    appointmentId: null,
    queueEntryId: 27,
    createdAt: '2026-11-05T11:20:00',
    readAt: '2026-11-05T11:45:00',
  },
];

// Shared sample state for the notifications page and the top bar dropdown,
// so both always show the same items and unread count.
// TODO(Lim, Jereign): back this with the notifications API.
@Injectable({ providedIn: 'root' })
export class PatientNotificationsStore {
  readonly notifications = signal<PatientNotification[]>([
    ...SAMPLE_NOTIFICATIONS,
  ]);
  readonly unreadCount = computed(
    (): number =>
      this.notifications().filter(
        (item: PatientNotification): boolean => item.readAt === null,
      ).length,
  );

  // Local only. TODO(Lim, Jereign): PATCH the read state through the API.
  markAsRead(id: number): void {
    const readAt = new Date().toISOString();
    this.notifications.update((items: PatientNotification[]) =>
      items.map(
        (item: PatientNotification): PatientNotification =>
          item.id === id && item.readAt === null ? { ...item, readAt } : item,
      ),
    );
  }

  // Local only. TODO(Lim, Jereign): call the API once it supports bulk read.
  markAllAsRead(): void {
    const readAt = new Date().toISOString();
    this.notifications.update((items: PatientNotification[]) =>
      items.map(
        (item: PatientNotification): PatientNotification =>
          item.readAt === null ? { ...item, readAt } : item,
      ),
    );
  }
}

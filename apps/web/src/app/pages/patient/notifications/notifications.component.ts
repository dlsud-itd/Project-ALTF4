import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

type TagSeverity = 'info' | 'warn' | 'secondary';
type NotificationType = 'QUEUE_CALL' | 'APPOINTMENT_REMINDER' | 'GENERAL';
type LoadState = 'loading' | 'ready' | 'error';

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

const SAMPLE_LOAD_DELAY_MS = 600;
const SKELETON_LINES = 5;

const TYPE_LABELS: Record<NotificationType, string> = {
  QUEUE_CALL: 'Queue call',
  APPOINTMENT_REMINDER: 'Reminder',
  GENERAL: 'General',
};

const TYPE_SEVERITIES: Record<NotificationType, TagSeverity> = {
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

// Sample data only. TODO(Lim, Jereign): replace with the notifications API.
const SAMPLE_NOTIFICATIONS: readonly PatientNotification[] = [
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

// Patient notifications page. Runs on sample data until the API is ready.
@Component({
  selector: 'app-patient-notifications',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    Button,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class PatientNotificationsComponent implements OnInit, OnDestroy {
  readonly skeletonLines = SKELETON_LINES;
  readonly loadState = signal<LoadState>('loading');
  readonly notifications = signal<PatientNotification[]>([]);
  readonly unreadCount = computed(
    (): number =>
      this.notifications().filter(
        (item: PatientNotification): boolean => item.readAt === null,
      ).length,
  );

  private loadTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  // TODO(Lim, Jereign): call the notifications API and set 'error' on failure.
  load(): void {
    this.clearTimer();
    this.loadState.set('loading');
    this.loadTimer = setTimeout((): void => {
      this.notifications.set([...SAMPLE_NOTIFICATIONS]);
      this.loadState.set('ready');
    }, SAMPLE_LOAD_DELAY_MS);
  }

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

  typeLabel(type: NotificationType): string {
    return TYPE_LABELS[type];
  }

  typeSeverity(type: NotificationType): TagSeverity {
    return TYPE_SEVERITIES[type];
  }

  routeFor(type: NotificationType): string | null {
    return TYPE_ROUTES[type];
  }

  linkLabel(type: NotificationType): string {
    return TYPE_LINK_LABELS[type];
  }

  private clearTimer(): void {
    if (this.loadTimer !== null) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }
}

import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  expand,
  map,
  of,
  reduce,
} from 'rxjs';
import {
  NotificationType,
  PatientNotification,
} from '@core/models/notification.models';
import { AuthService, NotificationsService } from '@core/services';
import { getErrorMessage } from '@core/utils';

export type NotificationTagSeverity = 'info' | 'warn' | 'secondary';

type NotificationLoadResult =
  | { notifications: PatientNotification[] }
  | { errorMessage: string };

const LOAD_ERROR_FALLBACK = 'Could not load notifications.';
const ACTION_ERROR_FALLBACK = 'Could not update notifications.';

const TYPE_SEVERITIES: Record<NotificationType, NotificationTagSeverity> = {
  BOOKING_CONFIRMATION: 'info',
  BOOKING_CANCELLATION: 'info',
  BOOKING_RESCHEDULE: 'info',
  QUEUE_STATUS_UPDATE: 'warn',
  APPROACHING_TURN: 'warn',
  QUEUE_CALL: 'warn',
  APPOINTMENT_REMINDER: 'info',
  GENERAL: 'secondary',
};

const TYPE_ROUTES: Record<NotificationType, string | null> = {
  BOOKING_CONFIRMATION: '/patient/bookings',
  BOOKING_CANCELLATION: '/patient/bookings',
  BOOKING_RESCHEDULE: '/patient/bookings',
  QUEUE_STATUS_UPDATE: '/patient/queue',
  APPROACHING_TURN: '/patient/queue',
  QUEUE_CALL: '/patient/queue',
  APPOINTMENT_REMINDER: '/patient/bookings',
  GENERAL: null,
};

const TYPE_LINK_LABELS: Record<NotificationType, string> = {
  BOOKING_CONFIRMATION: 'View booking history',
  BOOKING_CANCELLATION: 'View booking history',
  BOOKING_RESCHEDULE: 'View booking history',
  QUEUE_STATUS_UPDATE: 'View queue',
  APPROACHING_TURN: 'View queue',
  QUEUE_CALL: 'View queue',
  APPOINTMENT_REMINDER: 'View booking history',
  GENERAL: '',
};

export const notificationTypeSeverity = (
  type: NotificationType,
): NotificationTagSeverity => TYPE_SEVERITIES[type];

export const notificationRoute = (type: NotificationType): string | null =>
  TYPE_ROUTES[type];

export const notificationLinkLabel = (type: NotificationType): string =>
  TYPE_LINK_LABELS[type];

@Injectable({ providedIn: 'root' })
export class PatientNotificationsStore {
  private readonly notificationsService = inject(NotificationsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private hasLoaded = false;
  private streamSubscription: Subscription | null = null;

  readonly notifications = signal<PatientNotification[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly unreadCount = computed(
    (): number =>
      this.notifications().filter(
        (item: PatientNotification): boolean => !item.isRead,
      ).length,
  );

  load(force = false): void {
    if (this.isLoading() || (this.hasLoaded && !force)) {
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);
    this.getAllNotifications()
      .pipe(
        map(
          (notifications): NotificationLoadResult => ({
            notifications,
          }),
        ),
        catchError((error: unknown) =>
          of<NotificationLoadResult>({
            errorMessage:
              error instanceof HttpErrorResponse
                ? getErrorMessage(error, LOAD_ERROR_FALLBACK)
                : LOAD_ERROR_FALLBACK,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.isLoading.set(false);
        if ('errorMessage' in result) {
          this.loadError.set(result.errorMessage);
          return;
        }

        this.hasLoaded = true;
        this.loadError.set(null);
        this.notifications.set(result.notifications);
      });
  }

  connectLiveUpdates(): void {
    const token = this.authService.getToken();
    if (!token || this.streamSubscription) {
      return;
    }

    this.streamSubscription = this.notificationsService
      .streamNotifications(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => {
          this.load(true);
        },
        complete: (): void => {
          this.streamSubscription = null;
        },
      });
  }

  markAsRead(id: number): void {
    const notification = this.notifications().find((item) => item.id === id);
    if (!notification || notification.isRead) {
      return;
    }

    this.actionError.set(null);
    this.notificationsService
      .markAsRead(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedNotification): void => {
          this.notifications.update((items) =>
            items.map((item) =>
              item.id === id ? updatedNotification : item,
            ),
          );
        },
        error: (error: unknown): void => {
          this.actionError.set(this.getActionError(error));
        },
      });
  }

  markAllAsRead(): void {
    if (this.unreadCount() === 0) {
      return;
    }

    this.actionError.set(null);
    this.notificationsService
      .markAllAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => {
          const readAt = new Date().toISOString();
          this.notifications.update((items) =>
            items.map((item) =>
              item.isRead ? item : { ...item, isRead: true, readAt },
            ),
          );
        },
        error: (error: unknown): void => {
          this.actionError.set(this.getActionError(error));
        },
      });
  }

  private getAllNotifications(): Observable<PatientNotification[]> {
    return this.notificationsService.getMyNotifications().pipe(
      expand((response) =>
        response.page * response.limit < response.totalCount
          ? this.notificationsService.getMyNotifications(response.page + 1)
          : EMPTY,
      ),
      reduce(
        (notifications, response) => [
          ...notifications,
          ...response.notifications,
        ],
        [] as PatientNotification[],
      ),
    );
  }

  private getActionError(error: unknown): string {
    return error instanceof HttpErrorResponse
      ? getErrorMessage(error, ACTION_ERROR_FALLBACK)
      : ACTION_ERROR_FALLBACK;
  }
}

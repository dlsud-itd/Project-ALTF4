import {
  ChangeDetectionStrategy,
  Component,
  inject,
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
import {
  NotificationTagSeverity,
  NotificationType,
  notificationLinkLabel,
  notificationRoute,
  notificationTypeLabel,
  notificationTypeSeverity,
  PatientNotificationsStore,
} from './patient-notifications.store';

type LoadState = 'loading' | 'ready' | 'error';

const SAMPLE_LOAD_DELAY_MS = 600;
const SKELETON_LINES = 5;

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
  private readonly store = inject(PatientNotificationsStore);

  readonly skeletonLines = SKELETON_LINES;
  readonly loadState = signal<LoadState>('loading');
  readonly notifications = this.store.notifications;
  readonly unreadCount = this.store.unreadCount;

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
      this.loadState.set('ready');
    }, SAMPLE_LOAD_DELAY_MS);
  }

  markAsRead(id: number): void {
    this.store.markAsRead(id);
  }

  markAllAsRead(): void {
    this.store.markAllAsRead();
  }

  typeLabel(type: NotificationType): string {
    return notificationTypeLabel(type);
  }

  typeSeverity(type: NotificationType): NotificationTagSeverity {
    return notificationTypeSeverity(type);
  }

  routeFor(type: NotificationType): string | null {
    return notificationRoute(type);
  }

  linkLabel(type: NotificationType): string {
    return notificationLinkLabel(type);
  }

  private clearTimer(): void {
    if (this.loadTimer !== null) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }
}

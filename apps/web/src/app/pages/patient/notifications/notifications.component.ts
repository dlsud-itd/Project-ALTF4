import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NotificationType } from '@core/models';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import {
  NotificationTagSeverity,
  notificationLinkLabel,
  notificationRoute,
  notificationTypeSeverity,
  PatientNotificationsStore,
} from './patient-notifications.store';

const SKELETON_LINES = 5;

// Patient notifications page backed by the authenticated notifications API.
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
export class PatientNotificationsComponent implements OnInit {
  private readonly store = inject(PatientNotificationsStore);

  readonly skeletonLines = SKELETON_LINES;
  readonly notifications = this.store.notifications;
  readonly unreadCount = this.store.unreadCount;
  readonly isLoading = this.store.isLoading;
  readonly loadError = this.store.loadError;
  readonly actionError = this.store.actionError;

  ngOnInit(): void {
    this.store.load();
  }

  load(): void {
    this.store.load(true);
  }

  markAsRead(id: number): void {
    this.store.markAsRead(id);
  }

  markAllAsRead(): void {
    this.store.markAllAsRead();
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
}

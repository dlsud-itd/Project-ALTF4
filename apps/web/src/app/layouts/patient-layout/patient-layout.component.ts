import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { AuthService } from '@core/services';
import { NotificationType } from '@core/models';
import {
  NotificationTagSeverity,
  notificationLinkLabel,
  notificationRoute,
  notificationTypeSeverity,
  PatientNotificationsStore,
} from '../../pages/patient/notifications/patient-notifications.store';

const MAX_BADGE_COUNT = 9;
const DASHBOARD_ROUTE = '/patient/dashboard';
const SCHEDULE_ROUTE = '/patient/schedule';
const BOOKINGS_ROUTE = '/patient/bookings';
const QUEUE_ROUTE = '/patient/queue';
const DASHBOARD_SUBTITLE =
  'Manage your appointments and queue status at a glance';
const SCHEDULE_TITLE = 'Schedule Appointment';
const SCHEDULE_SUBTITLE =
  'Schedule your clinic visit with our university physician';
const BOOKING_HISTORY_TITLE = 'Booking History';
const BOOKING_HISTORY_SUBTITLE =
  'View and manage your appointments and past consultations';
const QUEUE_TITLE = 'Your Queue';
const PROFILE_ROUTE = '/patient/profile';
const PROFILE_TITLE = 'User Profile';
const PROFILE_SUBTITLE =
  'Manage your university health identification and account preferences';
const NOTIFICATIONS_ROUTE = '/patient/notifications';
const NOTIFICATIONS_TITLE = 'Notifications';
const NOTIFICATIONS_SUBTITLE = 'Updates about your queue and appointments';

// Page title shown on the left of the desktop top bar.
interface PageHeader {
  title: string;
  subtitle: string;
}

// Layout wrapping the authenticated patient portal with persistent sidebar navigation.
@Component({
  selector: 'app-patient-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button, Tag, DatePipe],
  templateUrl: './patient-layout.component.html',
  styleUrl: './patient-layout.component.scss',
})
export class PatientLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationsStore = inject(PatientNotificationsStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly patientName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Patient',
  );
  readonly patientEmail = computed(
    (): string => this.authService.currentUser()?.email ?? '',
  );
  readonly patientInitial = computed((): string =>
    this.patientName().charAt(0).toUpperCase(),
  );
  readonly isProfileMenuOpen = signal<boolean>(false);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd): string => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  readonly isDashboard = computed((): boolean =>
    this.currentUrl().startsWith(DASHBOARD_ROUTE),
  );
  // Dashboard, Booking History and Queue use a plain white page background.
  readonly hasWhitePageBg = computed((): boolean => {
    const url = this.currentUrl();
    return (
      url.startsWith(DASHBOARD_ROUTE) ||
      url.startsWith(SCHEDULE_ROUTE) ||
      url.startsWith(BOOKINGS_ROUTE) ||
      url.startsWith(QUEUE_ROUTE)
    );
  });
  // Title and subtitle for the top bar. Pages without one show nothing.
  readonly pageHeader = computed((): PageHeader | null => {
    const url = this.currentUrl();
    if (url.startsWith(DASHBOARD_ROUTE)) {
      return {
        title: `Welcome, ${this.patientName()}!`,
        subtitle: DASHBOARD_SUBTITLE,
      };
    }
    if (url.startsWith(SCHEDULE_ROUTE)) {
      return { title: SCHEDULE_TITLE, subtitle: SCHEDULE_SUBTITLE };
    }
    if (url.startsWith(BOOKINGS_ROUTE)) {
      return {
        title: BOOKING_HISTORY_TITLE,
        subtitle: BOOKING_HISTORY_SUBTITLE,
      };
    }
    if (url.startsWith(QUEUE_ROUTE)) {
      return { title: QUEUE_TITLE, subtitle: '' };
    }
    if (url.startsWith(PROFILE_ROUTE)) {
      return { title: PROFILE_TITLE, subtitle: PROFILE_SUBTITLE };
    }
    if (url.startsWith(NOTIFICATIONS_ROUTE)) {
      return { title: NOTIFICATIONS_TITLE, subtitle: NOTIFICATIONS_SUBTITLE };
    }
    return null;
  });
  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isCollapsed = signal<boolean>(false);

  // Shared with the notifications page so read state and counts stay in sync.
  readonly notifications = this.notificationsStore.notifications;
  readonly unreadCount = this.notificationsStore.unreadCount;
  readonly notificationsLoading = this.notificationsStore.isLoading;
  readonly notificationsError = this.notificationsStore.loadError;
  readonly notificationActionError = this.notificationsStore.actionError;
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly unreadLabel = computed((): string =>
    this.unreadCount() > MAX_BADGE_COUNT
      ? `${MAX_BADGE_COUNT}+`
      : String(this.unreadCount()),
  );

  ngOnInit(): void {
    this.notificationsStore.load();
    this.notificationsStore.connectLiveUpdates();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((open: boolean): boolean => !open);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  // Switches the desktop sidebar between the full menu and the icon rail.
  toggleCollapsed(): void {
    this.isCollapsed.update((collapsed: boolean): boolean => !collapsed);
  }

  toggleProfileMenu(): void {
    this.isNotificationsOpen.set(false);
    this.isProfileMenuOpen.update((open: boolean): boolean => !open);
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }

  toggleNotifications(): void {
    this.isProfileMenuOpen.set(false);
    this.isNotificationsOpen.update((open: boolean): boolean => !open);
  }

  closeNotifications(): void {
    this.isNotificationsOpen.set(false);
  }

  markNotificationRead(id: number): void {
    this.notificationsStore.markAsRead(id);
  }

  markAllNotificationsRead(): void {
    this.notificationsStore.markAllAsRead();
  }

  retryNotifications(): void {
    this.notificationsStore.load(true);
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

  // Closes the profile dropdown on an outside click or the Escape key.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const root = this.host.nativeElement;
    const target = event.target as Node;
    const profile = root.querySelector('.profile-menu');
    const bell = root.querySelector('.notifications-menu');
    if (profile && !profile.contains(target)) {
      this.closeProfileMenu();
    }
    if (bell && !bell.contains(target)) {
      this.closeNotifications();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeProfileMenu();
    this.closeNotifications();
  }

  onLogout(): void {
    this.closeProfileMenu();
    this.authService.performLogout();
  }
}

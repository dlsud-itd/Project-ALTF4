import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
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
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';

const WALK_IN_ROUTE = '/staff/walk-in';
const WALK_IN_TITLE = 'Walk-in';
const WALK_IN_SUBTITLE = 'Create a ticket for a patient who is on site';
const SCHEDULE_ROUTE = '/staff/schedule';
const SCHEDULE_TITLE = 'Slot Schedule';
const SCHEDULE_SUBTITLE = 'Upcoming clinic slots';
const PAST_APPOINTMENTS_ROUTE = '/staff/past-appointments';
const PAST_APPOINTMENTS_TITLE = 'Bookings history';
const PAST_APPOINTMENTS_SUBTITLE =
  'Archive of all past patient consultations and appointment outcomes';
const PROFILE_ROUTE = '/staff/profile';
const PROFILE_TITLE = 'Staff Profile';
const PROFILE_SUBTITLE =
  'Manage clinic staff credentials, duty assignments, and station preferences';
const DASHBOARD_ROUTE = '/staff/dashboard';
const DASHBOARD_TITLE = 'Dashboard';
const DASHBOARD_SUBTITLE = 'Walk-in queue with a 3-minute grace period';

// Admin Routes
const ADMIN_DASHBOARD_ROUTE = '/admin/dashboard';
const ADMIN_DASHBOARD_TITLE = 'Admin Overview';
const ADMIN_DASHBOARD_SUBTITLE =
  'System statistics and administrative control center';
const ADMIN_USERS_ROUTE = '/admin/users';
const ADMIN_USERS_TITLE = 'User Management';
const ADMIN_USERS_SUBTITLE =
  'Registry, role assignments, and account authorization';
const ADMIN_APPOINTMENTS_ROUTE = '/admin/appointments';
const ADMIN_APPOINTMENTS_TITLE = 'Appointments Master';
const ADMIN_APPOINTMENTS_SUBTITLE =
  'Complete institutional consultations and booking record';
const ADMIN_AUDIT_ROUTE = '/admin/audit-logs';
const ADMIN_AUDIT_TITLE = 'Audit Trail';
const ADMIN_AUDIT_SUBTITLE =
  'Immutable activity history and security operations';

// Title and subtitle shown on the left of the desktop top bar.
interface PageHeader {
  title: string;
  subtitle: string;
}

// Layout wrapping the authenticated staff operations console with persistent sidebar navigation.
@Component({
  selector: 'app-staff-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button],
  templateUrl: './staff-layout.component.html',
  styleUrl: './staff-layout.component.scss',
})
export class StaffLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly staffName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Staff Nurse',
  );
  readonly staffRole = computed(
    (): string => this.authService.currentUser()?.role ?? 'STAFF',
  );
  readonly isAdmin = computed(
    (): boolean => this.staffRole().toUpperCase() === 'ADMIN',
  );
  readonly staffEmail = computed(
    (): string => this.authService.currentUser()?.email ?? '',
  );
  readonly staffInitial = computed((): string =>
    this.staffName().charAt(0).toUpperCase(),
  );
  readonly roleLabel = computed((): string =>
    this.isAdmin() ? 'Admin' : 'Staff',
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

  // Title and subtitle for the top bar.
  readonly pageHeader = computed((): PageHeader | null => {
    const url = this.currentUrl();
    if (url.startsWith(ADMIN_DASHBOARD_ROUTE)) {
      return {
        title: ADMIN_DASHBOARD_TITLE,
        subtitle: ADMIN_DASHBOARD_SUBTITLE,
      };
    }
    if (url.startsWith(ADMIN_USERS_ROUTE)) {
      return { title: ADMIN_USERS_TITLE, subtitle: ADMIN_USERS_SUBTITLE };
    }
    if (url.startsWith(ADMIN_APPOINTMENTS_ROUTE)) {
      return {
        title: ADMIN_APPOINTMENTS_TITLE,
        subtitle: ADMIN_APPOINTMENTS_SUBTITLE,
      };
    }
    if (url.startsWith(ADMIN_AUDIT_ROUTE)) {
      return { title: ADMIN_AUDIT_TITLE, subtitle: ADMIN_AUDIT_SUBTITLE };
    }
    if (url.startsWith(DASHBOARD_ROUTE)) {
      return { title: DASHBOARD_TITLE, subtitle: DASHBOARD_SUBTITLE };
    }
    if (url.startsWith(WALK_IN_ROUTE)) {
      return { title: WALK_IN_TITLE, subtitle: WALK_IN_SUBTITLE };
    }
    if (url.startsWith(SCHEDULE_ROUTE)) {
      return { title: SCHEDULE_TITLE, subtitle: SCHEDULE_SUBTITLE };
    }
    if (url.startsWith(PAST_APPOINTMENTS_ROUTE)) {
      return {
        title: PAST_APPOINTMENTS_TITLE,
        subtitle: PAST_APPOINTMENTS_SUBTITLE,
      };
    }
    if (url.startsWith(PROFILE_ROUTE)) {
      return { title: PROFILE_TITLE, subtitle: PROFILE_SUBTITLE };
    }
    return null;
  });

  // Pages with light surface background.
  readonly hasWhitePageBg = computed((): boolean => {
    const url = this.currentUrl();
    return (
      url.startsWith(DASHBOARD_ROUTE) ||
      url.startsWith(PAST_APPOINTMENTS_ROUTE) ||
      url.startsWith('/admin')
    );
  });
  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isCollapsed = signal<boolean>(false);
  // True while a page shows a side panel: the sidebar then floats over the
  // page when expanded instead of pushing it aside.
  readonly isSidePanelOpen = signal<boolean>(false);
  private wasCollapsedBeforePanel = false;

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

  // Collapses the sidebar while a side panel is open, then restores it.
  setSidePanelOpen(isOpen: boolean): void {
    if (isOpen === this.isSidePanelOpen()) {
      return;
    }
    this.isSidePanelOpen.set(isOpen);
    if (isOpen) {
      this.wasCollapsedBeforePanel = this.isCollapsed();
      this.isCollapsed.set(true);
    } else {
      this.isCollapsed.set(this.wasCollapsedBeforePanel);
    }
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((open: boolean): boolean => !open);
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }

  // Closes the profile dropdown on an outside click or the Escape key.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const menu = this.host.nativeElement.querySelector('.profile-menu');
    if (menu && !menu.contains(event.target as Node)) {
      this.closeProfileMenu();
    }

    // With a side panel open, a click outside the sidebar collapses it again.
    const sidebar = this.host.nativeElement.querySelector('.portal-sidebar');
    if (this.isSidePanelOpen() && !sidebar?.contains(event.target as Node)) {
      this.isCollapsed.set(true);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeProfileMenu();
  }

  onLogout(): void {
    this.closeProfileMenu();
    this.authService.performLogout();
  }
}

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
const SCHEDULE_SUBTITLE = 'Clinic slots for the next two weeks';
const PROFILE_ROUTE = '/staff/profile';
const PROFILE_TITLE = 'Staff Profile';
const PROFILE_SUBTITLE =
  'Manage clinic staff credentials, duty assignments, and station preferences';
const DASHBOARD_ROUTE = '/staff/dashboard';
const DASHBOARD_TITLE = 'Dashboard';
const DASHBOARD_SUBTITLE = 'Walk-in queue with a 3-minute grace period';

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
  readonly staffEmail = computed(
    (): string => this.authService.currentUser()?.email ?? '',
  );
  readonly staffInitial = computed((): string =>
    this.staffName().charAt(0).toUpperCase(),
  );
  readonly roleLabel = computed((): string =>
    this.staffRole() === 'ADMIN' ? 'Admin' : 'Staff',
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
  // Title and subtitle for the top bar. The dashboard page keeps only its
  // queue controls row.
  readonly pageHeader = computed((): PageHeader | null => {
    const url = this.currentUrl();
    if (url.startsWith(DASHBOARD_ROUTE)) {
      return { title: DASHBOARD_TITLE, subtitle: DASHBOARD_SUBTITLE };
    }
    if (url.startsWith(WALK_IN_ROUTE)) {
      return { title: WALK_IN_TITLE, subtitle: WALK_IN_SUBTITLE };
    }
    if (url.startsWith(SCHEDULE_ROUTE)) {
      return { title: SCHEDULE_TITLE, subtitle: SCHEDULE_SUBTITLE };
    }
    if (url.startsWith(PROFILE_ROUTE)) {
      return { title: PROFILE_TITLE, subtitle: PROFILE_SUBTITLE };
    }
    return null;
  });
  // The dashboard uses the light page background like the patient dashboard.
  readonly hasWhitePageBg = computed((): boolean =>
    this.currentUrl().startsWith(DASHBOARD_ROUTE),
  );
  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isCollapsed = signal<boolean>(false);

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

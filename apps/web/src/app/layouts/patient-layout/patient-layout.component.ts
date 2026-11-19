import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';

const SAMPLE_UNREAD_COUNT = 3;
const MAX_BADGE_COUNT = 9;

// Layout wrapping the authenticated patient portal with persistent sidebar navigation.
@Component({
  selector: 'app-patient-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button],
  templateUrl: './patient-layout.component.html',
  styleUrl: './patient-layout.component.scss',
})
export class PatientLayoutComponent {
  private readonly authService = inject(AuthService);

  readonly patientName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Patient',
  );
  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isCollapsed = signal<boolean>(false);

  // TODO(Lim, Jereign): sample value. Replace with the real unread count
  // from the notifications API (shared service) so it matches the page.
  readonly unreadCount = signal<number>(SAMPLE_UNREAD_COUNT);
  readonly unreadLabel = computed((): string =>
    this.unreadCount() > MAX_BADGE_COUNT
      ? `${MAX_BADGE_COUNT}+`
      : String(this.unreadCount()),
  );

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

  onLogout(): void {
    this.authService.performLogout();
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';

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

  readonly staffName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Staff Nurse',
  );
  readonly staffRole = computed(
    (): string => this.authService.currentUser()?.role ?? 'STAFF',
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

  onLogout(): void {
    this.authService.performLogout();
  }
}
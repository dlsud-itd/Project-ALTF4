import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';

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

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((open: boolean): boolean => !open);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  onLogout(): void {
    this.authService.performLogout();
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';

// Staff console component for managing counter assignments, queue progression, and consultation records.
@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [Button],
  templateUrl: './staff-dashboard.component.html',
  styleUrl: './staff-dashboard.component.scss',
})
export class StaffDashboardComponent {
  private readonly authService = inject(AuthService);

  readonly staffName = computed((): string => this.authService.currentUser()?.fullName ?? 'Staff Nurse');
  readonly staffEmail = computed((): string => this.authService.currentUser()?.email ?? 'staff@dlsud.edu.ph');
  readonly staffRole = computed((): string => this.authService.currentUser()?.role ?? 'STAFF');
  readonly counterNumber = signal<number>(1);
  readonly servingTicket = signal<string>('A-104');
  readonly waitingCount = signal<number>(5);
  readonly completedCount = signal<number>(18);

  // Signs out the staff session, invalidates the server-side token, and redirects to login.
  onLogout(): void {
    this.authService.performLogout();
  }

  // Increments the serving ticket number and reduces the waiting patient count.
  onCallNext(): void {
    if (this.waitingCount() > 0) {
      this.waitingCount.update((count) => count - 1);
      const nextNum = parseInt(this.servingTicket().replace('A-', ''), 10) + 1;
      this.servingTicket.set(`A-${nextNum}`);
    }
  }

  // Increments the counter for completed consultations for the day.
  onComplete(): void {
    this.completedCount.update((c) => c + 1);
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [Button, RouterLink],
  templateUrl: './staff-dashboard.component.html',
  styleUrl: './staff-dashboard.component.scss',
})
export class StaffDashboardComponent {
  private readonly authService = inject(AuthService);

  readonly staffName = computed(() => this.authService.currentUser()?.fullName ?? 'Staff Nurse');
  readonly staffEmail = computed(() => this.authService.currentUser()?.email ?? 'staff@dlsud.edu.ph');
  readonly staffRole = computed(() => this.authService.currentUser()?.role ?? 'STAFF');
  readonly counterNumber = signal<number>(1);
  readonly servingTicket = signal<string>('A-104');
  readonly waitingCount = signal<number>(5);
  readonly completedCount = signal<number>(18);

  onCallNext(): void {
    if (this.waitingCount() > 0) {
      this.waitingCount.update((count) => count - 1);
      const nextNum = parseInt(this.servingTicket().replace('A-', ''), 10) + 1;
      this.servingTicket.set(`A-${nextNum}`);
    }
  }

  onComplete(): void {
    this.completedCount.update((c) => c + 1);
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

// Staff console component for managing counter assignments, queue progression, and consultation records.
@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [
    Button,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './staff-dashboard.component.html',
  styleUrl: './staff-dashboard.component.scss',
})
export class StaffDashboardComponent {
  private readonly authService = inject(AuthService);

  readonly staffName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Staff Nurse',
  );
  readonly staffEmail = computed(
    (): string => this.authService.currentUser()?.email ?? 'staff@dlsud.edu.ph',
  );
  readonly staffRole = computed(
    (): string => this.authService.currentUser()?.role ?? 'STAFF',
  );
  readonly counterNumber = signal<number>(1);
  readonly servingTicket = signal<string>('A-104');
  readonly waitingCount = signal<number>(5);
  readonly completedCount = signal<number>(18);

  // TODO(Lim, Jereign): drive these from the queue API once it is connected
  readonly isStatsLoading = signal<boolean>(false);
  readonly hasStatsError = signal<boolean>(false);

  // Increments the serving ticket number and reduces the waiting patient count.
  onCallNext(): void {
    if (this.waitingCount() > 0) {
      this.waitingCount.update((count: number): number => count - 1);
      const nextNum: number = parseInt(this.servingTicket().replace('A-', ''), 10) + 1;
      this.servingTicket.set(`A-${nextNum}`);
    }
  }

  // Clears the stats error so the queue numbers can load again.
  onRetryStats(): void {
    this.hasStatsError.set(false);
  }

  // Increments the counter for completed consultations for the day.
  onComplete(): void {
    this.completedCount.update((c: number): number => c + 1);
  }
}


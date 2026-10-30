import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

// Patient portal dashboard presenting ticket status, clinic schedules, and appointment shortcuts.
@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    Button,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
})
export class PatientDashboardComponent {
  private readonly authService = inject(AuthService);

  readonly patientName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Patient',
  );
  readonly currentTicket = signal<string | null>(null);
  readonly nowServingTicket = signal<string>('A-104');

  // TODO(Lim, Jereign): drive these from the queue API once it is connected
  readonly isQueueLoading = signal<boolean>(false);
  readonly hasQueueError = signal<boolean>(false);

  // Enqueues the patient into the active daily queue and assigns an estimated wait ticket.
  onJoinQueue(): void {
    this.currentTicket.set('A-108');
  }

  // Cancels the current queue ticket and resets active patient queue state.
  onLeaveQueue(): void {
    this.currentTicket.set(null);
  }

  // Clears the queue error so the status card can load again.
  onRetryQueue(): void {
    this.hasQueueError.set(false);
  }
}


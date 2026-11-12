import { Component, input, output } from '@angular/core';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import { QueueStatus, QueueTicketSummary, ServingTicket } from '@core/models';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-staff-queue-panel',
  standalone: true,
  imports: [
    Button,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './staff-queue-panel.component.html',
  styleUrl: './staff-queue-panel.component.scss',
})
export class StaffQueuePanelComponent {
  readonly QueueStatus = QueueStatus;
  readonly isQueueActive = input.required<boolean>();
  readonly currentTicket = input.required<ServingTicket | null>();
  readonly isCalled = input.required<boolean>();
  readonly isInService = input.required<boolean>();
  readonly isUpdatingStatus = input.required<boolean>();
  readonly graceCountdownText = input.required<string>();
  readonly isGracePeriodAmber = input.required<boolean>();
  readonly isGracePeriodRed = input.required<boolean>();
  readonly isGeneratingQueue = input.required<boolean>();
  readonly isRecalling = input.required<boolean>();
  readonly waitingCount = input.required<number>();
  readonly waitingTickets = input.required<QueueTicketSummary[]>();
  readonly isStatsLoading = input.required<boolean>();
  readonly hasStatsError = input.required<boolean>();

  readonly callNext = output<void>();
  readonly patientArrived = output<void>();
  readonly markNoShow = output<void>();
  readonly cancelEntry = output<void>();
  readonly retryStats = output<void>();
  onCallNext(): void {
    this.callNext.emit();
  }

  onPatientArrived(): void {
    this.patientArrived.emit();
  }

  onMarkNoShow(): void {
    this.markNoShow.emit();
  }

  onCancelEntry(): void {
    this.cancelEntry.emit();
  }

  onRetryStats(): void {
    this.retryStats.emit();
  }
}

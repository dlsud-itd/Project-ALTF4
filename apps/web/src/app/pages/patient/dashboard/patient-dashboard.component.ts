import {
  Component,
  DestroyRef,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { merge } from 'rxjs';
import {
  AuthService,
  AppointmentsService,
  QueueService,
  SseService,
} from '@core/services';
import {
  PatientAppointment,
  AppointmentStatus,
  QueueStatusResponse,
  PatientQueueEntryResponse,
  WalkInResponse,
} from '@core/models';
import { getErrorMessage } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

type TagSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

const CURRENT_QUEUE_ID = 1;

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No Show',
};

const STATUS_SEVERITIES: Record<AppointmentStatus, TagSeverity> = {
  BOOKED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'info',
  NO_SHOW: 'secondary',
};

// Patient portal dashboard presenting ticket status, clinic schedules, and active appointments.
@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    Button,
    ConfirmDialog,
    Message,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
})
export class PatientDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly queueService = inject(QueueService);
  private readonly sseService = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationService = inject(ConfirmationService);

  readonly patientName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Patient',
  );
  readonly currentTicket = signal<string | null>(null);
  readonly estimatedWaitMinutes = signal<number>(10);
  readonly nowServingTicket = signal<string>('None yet');
  readonly nowServingRoom = signal<string>('Counter 1');

  // Queue state
  readonly isQueueLoading = signal<boolean>(false);
  readonly hasQueueError = signal<boolean>(false);
  readonly isJoiningQueue = signal<boolean>(false);
  readonly joinQueueError = signal<string | null>(null);

  // Appointments state
  readonly appointments = signal<PatientAppointment[]>([]);
  readonly isAppointmentsLoading = signal<boolean>(false);
  readonly appointmentsError = signal<string | null>(null);
  readonly cancellingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  // Computed subsets
  readonly upcomingAppointments = computed((): PatientAppointment[] => {
    return this.appointments().filter(
      (a: PatientAppointment): boolean => a.status === 'BOOKED',
    );
  });

  readonly pastAppointments = computed((): PatientAppointment[] => {
    return this.appointments().filter(
      (a: PatientAppointment): boolean => a.status !== 'BOOKED',
    );
  });

  ngOnInit(): void {
    this.loadAppointments();
    this.loadQueueStatus();
    this.loadMyQueueEntry();
    this.listenForSseEvents();
  }

  private listenForSseEvents(): void {
    merge(this.sseService.queueUpdated$, this.sseService.queueCalled$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => {
        this.loadQueueStatus();
        this.loadMyQueueEntry();
      });

    this.destroyRef.onDestroy((): void => this.sseService.disconnect());
    this.sseService.subscribeToQueue(CURRENT_QUEUE_ID);
  }

  loadQueueStatus(): void {
    this.isQueueLoading.set(true);
    this.hasQueueError.set(false);

    this.queueService.getQueueStatus(CURRENT_QUEUE_ID).subscribe({
      next: (res: QueueStatusResponse): void => {
        if (res.currently_serving) {
          this.nowServingTicket.set(res.currently_serving.ticket_number);
          this.nowServingRoom.set(res.currently_serving.room_number || 'Counter 1');
        } else {
          this.nowServingTicket.set('None yet');
          this.nowServingRoom.set('Counter 1');
        }
        this.isQueueLoading.set(false);
      },
      error: (): void => {
        this.hasQueueError.set(true);
        this.isQueueLoading.set(false);
      },
    });
  }

  loadMyQueueEntry(): void {
    this.queueService.getMyQueueEntry(CURRENT_QUEUE_ID).subscribe({
      next: (entry: PatientQueueEntryResponse | null): void => {
        if (entry) {
          this.currentTicket.set(entry.ticket_number);
          this.estimatedWaitMinutes.set(entry.estimated_wait_minutes);
        } else {
          this.currentTicket.set(null);
        }
      },
      error: (): void => {
        // Silently ignore if unauthenticated or not found
      },
    });
  }

  loadAppointments(): void {
    this.isAppointmentsLoading.set(true);
    this.appointmentsError.set(null);

    this.appointmentsService.getMyAppointments().subscribe({
      next: (res): void => {
        this.appointments.set(res.appointments);
        this.isAppointmentsLoading.set(false);
      },
      error: (err: HttpErrorResponse): void => {
        this.appointmentsError.set(
          getErrorMessage(err, 'Could not load your appointments.'),
        );
        this.isAppointmentsLoading.set(false);
      },
    });
  }

  onCancelAppointment(appointment: PatientAppointment): void {
    this.confirmationService.confirm({
      header: 'Cancel Appointment',
      message: `Are you sure you want to cancel your consultation on ${this.formatClinicDate(appointment.slot.clinicDate)} at ${appointment.slot.startTime}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes, Cancel',
      rejectLabel: 'Keep Appointment',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => {
        this.cancellingId.set(appointment.id);
        this.actionError.set(null);
        this.actionSuccess.set(null);

        this.appointmentsService.cancelAppointment(appointment.id).subscribe({
          next: (): void => {
            this.cancellingId.set(null);
            this.actionSuccess.set('Appointment cancelled successfully.');
            this.loadAppointments();
          },
          error: (err: HttpErrorResponse): void => {
            this.cancellingId.set(null);
            this.actionError.set(
              getErrorMessage(err, 'Could not cancel the appointment. Please try again.'),
            );
          },
        });
      },
    });
  }

  formatClinicDate(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  statusLabel(status: AppointmentStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusSeverity(status: AppointmentStatus): TagSeverity {
    return STATUS_SEVERITIES[status] ?? 'secondary';
  }

  onJoinQueue(): void {
    const user = this.authService.currentUser();
    const name = user?.fullName || 'Online Patient';
    const patientId = user?.id;

    this.isJoiningQueue.set(true);
    this.joinQueueError.set(null);

    this.queueService
      .joinOnline(CURRENT_QUEUE_ID, {
        name,
        patientId,
        reasonForVisit: 'General Consultation',
      })
      .subscribe({
        next: (response: WalkInResponse): void => {
          this.currentTicket.set(response.ticket_number);
          this.estimatedWaitMinutes.set(response.estimated_wait_minutes);
          this.isJoiningQueue.set(false);
          this.loadQueueStatus();
        },
        error: (err: HttpErrorResponse): void => {
          this.isJoiningQueue.set(false);
          if (err.status === 409) {
            this.loadMyQueueEntry();
          } else {
            this.joinQueueError.set(
              getErrorMessage(err, 'Could not join the queue. Please try again.'),
            );
          }
        },
      });
  }

  onLeaveQueue(): void {
    this.confirmationService.confirm({
      header: 'Leave Queue',
      message: 'Are you sure you want to dismiss this ticket from your dashboard?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes, Dismiss',
      rejectLabel: 'Keep Ticket',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => {
        this.currentTicket.set(null);
      },
    });
  }

  onRetryQueue(): void {
    this.loadQueueStatus();
    this.loadMyQueueEntry();
  }
}

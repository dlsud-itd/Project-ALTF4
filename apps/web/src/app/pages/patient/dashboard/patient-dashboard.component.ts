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
import { catchError, merge, of, Subject, switchMap } from 'rxjs';
import {
  AuthService,
  AppointmentsService,
  QueueService,
  PatientAppointmentsStore,
  SseService,
} from '@core/services';
import {
  PatientAppointment,
  AppointmentStatus,
  QueueStatusResponse,
} from '@core/models';
import { formatTime12h, formatTimeRange, getErrorMessage } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

type TagSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

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
  private readonly appointmentsStore = inject(PatientAppointmentsStore);
  private readonly sseService = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationService = inject(ConfirmationService);

  readonly patientName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Patient',
  );
  private readonly queueRefresh$ = new Subject<void>();
  readonly activeQueueEntry = this.appointmentsStore.activeQueueEntry;
  readonly currentTicket = computed(
    () => this.activeQueueEntry()?.reservedQueueEntry?.ticketNumber ?? null,
  );
  readonly positionInQueue = computed(
    () => this.activeQueueEntry()?.reservedQueueEntry?.positionInQueue ?? null,
  );
  readonly estimatedWaitMinutes = computed(
    () =>
      this.activeQueueEntry()?.reservedQueueEntry?.estimatedWaitMinutes ?? 0,
  );
  readonly nowServingTicket = signal<string>('None yet');
  readonly nowServingRoom = signal<string>('Counter 1');

  readonly patientsAhead = computed((): number => {
    const pos = this.positionInQueue();
    if (pos === null || pos <= 1) return 0;
    return pos - 1;
  });

  // Queue state
  readonly isQueueLoading = signal<boolean>(false);
  readonly hasQueueError = signal<boolean>(false);

  // Appointments state
  readonly appointments = this.appointmentsStore.appointments;
  readonly isAppointmentsLoading = this.appointmentsStore.isLoading;
  readonly appointmentsError = this.appointmentsStore.error;
  readonly cancellingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  // Computed subsets
  readonly upcomingAppointments = computed((): PatientAppointment[] => {
    return this.appointments().filter(
      (a: PatientAppointment): boolean =>
        a.status === 'BOOKED' && !a.slot.isExpired,
    );
  });

  ngOnInit(): void {
    this.appointmentsStore.load();
    this.listenForSseEvents();
    this.listenForQueueRefreshes();
    this.loadQueueStatus();
    this.destroyRef.onDestroy((): void => this.sseService.disconnect());
  }

  private listenForQueueRefreshes(): void {
    this.queueRefresh$
      .pipe(
        switchMap(() =>
          this.queueService.getTodayQueue().pipe(
            switchMap((todayQueue) => {
              this.sseService.subscribeToQueue(todayQueue.id);
              return this.queueService.getQueueStatus(todayQueue.id);
            }),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: QueueStatusResponse | null): void => {
        this.isQueueLoading.set(false);
        if (!res) {
          this.hasQueueError.set(true);
          return;
        }
        this.hasQueueError.set(false);
        if (res.currently_serving) {
          this.nowServingTicket.set(res.currently_serving.ticket_number);
          this.nowServingRoom.set(res.currently_serving.room_number || 'Counter 1');
          return;
        }
        this.nowServingTicket.set('None yet');
        this.nowServingRoom.set('Counter 1');
      });
  }

  private listenForSseEvents(): void {
    merge(this.sseService.queueUpdated$, this.sseService.queueCalled$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => {
        this.appointmentsStore.load();
        this.loadQueueStatus();
      });
  }

  loadQueueStatus(): void {
    this.isQueueLoading.set(true);
    this.hasQueueError.set(false);
    this.queueRefresh$.next();
  }

  loadAppointments(): void {
    this.appointmentsStore.load();
  }

  onCancelAppointment(appointment: PatientAppointment): void {
    this.confirmationService.confirm({
      header: 'Cancel Appointment',
      message: `Are you sure you want to cancel your consultation on ${this.formatClinicDate(appointment.slot.clinicDate)} at ${this.formatTime(appointment.slot.startTime)}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes, Cancel',
      rejectLabel: 'Keep Appointment',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => {
        this.cancellingId.set(appointment.id);
        this.actionError.set(null);
        this.actionSuccess.set(null);

        this.appointmentsService
          .cancelAppointment(appointment.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
          next: (): void => {
            this.cancellingId.set(null);
            this.actionSuccess.set('Appointment and queue ticket cancelled successfully.');
            // Clear queue ticket and position immediately on dashboard
            this.appointmentsStore.load();
            this.loadQueueStatus();
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

  formatTimeRange(startTime: string, endTime: string): string {
    return formatTimeRange(startTime, endTime);
  }

  formatTime(timeStr: string): string {
    return formatTime12h(timeStr);
  }

  statusLabel(status: AppointmentStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusSeverity(status: AppointmentStatus): TagSeverity {
    return STATUS_SEVERITIES[status] ?? 'secondary';
  }

  onRetryQueue(): void {
    this.loadQueueStatus();
  }
}

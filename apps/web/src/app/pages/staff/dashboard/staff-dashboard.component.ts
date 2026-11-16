import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { interval } from 'rxjs';
import { merge } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { AuthService, QueueService, SseService } from '@core/services';
import {
  AppointmentStatus,
  QueueStatus,
  QueueStatusResponse,
  QueueTicketSummary,
  ServingTicket,
} from '@core/models';
import { getErrorMessage } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

type AppointmentTagSeverity = 'info' | 'success' | 'secondary' | 'danger';

type StaffAppointmentRow = {
  id: number;
  patientName: string;
  clinicDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
};

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
// TODO(Lim, Jereign): enable once the API accepts these statuses
const IS_NO_SHOW_CANCEL_ENABLED = false;
const NOTES_MAX_LENGTH = 500;
const ROOM_MAX_LENGTH = 50;
const PRACTITIONER_MAX_LENGTH = 100;
const ROOM_PREFIX = 'Counter';
const DEFAULT_PRACTITIONER_NAME = 'Staff Nurse';
const CALL_NEXT_ERROR = 'Could not call the next patient.';
const START_ERROR = 'Could not start the consultation.';
const COMPLETE_ERROR = 'Could not complete the consultation.';
const NO_SHOW_ERROR = 'Could not mark the patient as no-show.';
const CANCEL_ERROR = 'Could not cancel the ticket.';

type StatusErrorTarget = 'page' | 'complete-dialog';

type StatusUpdateOptions = {
  notes?: string;
  fallbackMessage: string;
  errorTarget: StatusErrorTarget;
};

// Rejects values that are empty or only whitespace.
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length > 0 ? null : { required: true };
}
const QUEUE_NOT_FOUND_CODE = 'QUEUE_NOT_FOUND';
const DATE_DISPLAY_FORMAT = 'EEE, MMM d';
const MINUTES_PER_HOUR = 60;
const NOON_HOUR = 12;
const HOURS_PER_DAY = 24;
const TIME_SEPARATOR = ':';
const TIME_RANGE_SEPARATOR = ' to ';
const MORNING_SUFFIX = 'AM';
const AFTERNOON_SUFFIX = 'PM';

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

const APPOINTMENT_STATUS_SEVERITIES: Record<
  AppointmentStatus,
  AppointmentTagSeverity
> = {
  BOOKED: 'info',
  CANCELLED: 'secondary',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
};

// TODO(Lim, Jereign): replace with GET /appointments (staff)
const SAMPLE_APPOINTMENTS: StaffAppointmentRow[] = [
  {
    id: 1,
    patientName: 'Sample Patient A',
    clinicDate: '2026-11-12',
    startTime: '08:00',
    endTime: '08:30',
    status: 'BOOKED',
  },
  {
    id: 2,
    patientName: 'Sample Patient B',
    clinicDate: '2026-11-12',
    startTime: '09:30',
    endTime: '10:00',
    status: 'BOOKED',
  },
  {
    id: 3,
    patientName: 'Sample Patient C',
    clinicDate: '2026-11-13',
    startTime: '13:00',
    endTime: '13:30',
    status: 'COMPLETED',
  },
  {
    id: 4,
    patientName: 'Sample Patient D',
    clinicDate: '2026-11-13',
    startTime: '15:30',
    endTime: '16:00',
    status: 'NO_SHOW',
  },
];

// Converts a 24-hour "HH:mm" value to a 12-hour label such as "8:00 AM".
function formatTime12h(time: string): string {
  const [hourText, minuteText] = time.split(TIME_SEPARATOR);
  const hour = Number(hourText) % HOURS_PER_DAY;
  const suffix = hour >= NOON_HOUR ? AFTERNOON_SUFFIX : MORNING_SUFFIX;
  const displayHour = hour % NOON_HOUR === 0 ? NOON_HOUR : hour % NOON_HOUR;
  return `${displayHour}${TIME_SEPARATOR}${minuteText} ${suffix}`;
}

// Staff console component for managing counter assignments, queue progression, and consultation records.
@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [
    Button,
    ConfirmDialog,
    DatePipe,
    Dialog,
    Message,
    ReactiveFormsModule,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './staff-dashboard.component.html',
  styleUrl: './staff-dashboard.component.scss',
})
export class StaffDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly queueService = inject(QueueService);
  private readonly sseService = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  readonly queueId = signal<number>(1);
  readonly counterNumber = signal<number>(1);
  readonly servingTicket = signal<string>('—');
  readonly currentTicket = signal<ServingTicket | null>(null);
  readonly countdownSeconds = signal<number>(0);
  private serverClockOffsetMs = 0;
  readonly waitingCount = signal<number>(0);
  readonly waitingTickets = signal<QueueTicketSummary[]>([]);
  readonly completedCount = signal<number>(0);
  readonly isGeneratingQueue = signal<boolean>(false);
  readonly isUpdatingStatus = signal<boolean>(false);
  readonly isCallNextDialogOpen = signal<boolean>(false);
  readonly isCompleteDialogOpen = signal<boolean>(false);
  readonly isNoShowCancelEnabled = IS_NO_SHOW_CANCEL_ENABLED;
  readonly notesMaxLength = NOTES_MAX_LENGTH;
  readonly roomMaxLength = ROOM_MAX_LENGTH;
  readonly practitionerMaxLength = PRACTITIONER_MAX_LENGTH;
  // Page level message, only for actions that have no dialog of their own.
  readonly actionError = signal<string | null>(null);
  readonly callNextError = signal<string | null>(null);
  readonly completeError = signal<string | null>(null);
  readonly completeTicketNumber = signal<string>('');
  readonly callNextForm = this.formBuilder.nonNullable.group({
    roomNumber: ['', [notBlank, Validators.maxLength(ROOM_MAX_LENGTH)]],
    practitionerName: [
      '',
      [notBlank, Validators.maxLength(PRACTITIONER_MAX_LENGTH)],
    ],
  });
  readonly completeNotes = this.formBuilder.nonNullable.control('', [
    Validators.maxLength(NOTES_MAX_LENGTH),
  ]);
  readonly dateFormat = DATE_DISPLAY_FORMAT;
  // TODO(Lim, Jereign): replace with GET /appointments (staff)
  readonly appointments = signal<StaffAppointmentRow[]>(SAMPLE_APPOINTMENTS);
  // TODO(Lim, Jereign): set from the appointments request state
  readonly isAppointmentsLoading = signal<boolean>(false);
  // TODO(Lim, Jereign): set from the appointments request state
  readonly hasAppointmentsError = signal<boolean>(false);
  readonly hasAppointments = computed(
    (): boolean => this.appointments().length > 0,
  );
  readonly isQueueActive = signal<boolean>(true);

  readonly isStatsLoading = signal<boolean>(true);
  readonly hasStatsError = signal<boolean>(false);
  private expiryRefreshKey: string | null = null;

  ngOnInit(): void {
    this.listenForSseEvents();
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => this.updateCountdown());
    this.destroyRef.onDestroy(() => this.sseService.disconnect());
    this.sseService.subscribeToQueue(this.queueId());
    this.loadQueueStatus();
  }

  private listenForSseEvents(): void {
    merge(this.sseService.queueUpdated$, this.sseService.queueCalled$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadQueueStatus());
  }

  private loadQueueStatus(): void {
    this.isStatsLoading.set(true);
    this.hasStatsError.set(false);

    this.queueService.getQueueStatus(this.queueId()).subscribe({
      next: (response: QueueStatusResponse): void => {
        const currentTicket = response.currently_serving;
        this.serverClockOffsetMs =
          new Date(response.server_time).getTime() - Date.now();
        this.isQueueActive.set(response.is_active);
        this.currentTicket.set(currentTicket);
        this.servingTicket.set(currentTicket?.ticket_number ?? '—');
        this.waitingCount.set(response.total_waiting ?? 0);
        this.waitingTickets.set(response.waiting_tickets ?? []);
        this.completedCount.set(response.total_completed_today ?? 0);
        this.updateCountdown();
        this.isStatsLoading.set(false);
      },
      error: (error: HttpErrorResponse): void => {
        if (this.isQueueNotFound(error)) {
          this.isQueueActive.set(false);
        } else {
          this.hasStatsError.set(true);
        }
        this.isStatsLoading.set(false);
      },
    });
  }

  private isQueueNotFound(error: HttpErrorResponse): boolean {
    const body = error.error as { code?: unknown } | null;
    return (
      error.status === HTTP_NOT_FOUND && body?.code === QUEUE_NOT_FOUND_CODE
    );
  }

  private updateCountdown(): void {
    const ticket = this.currentTicket();
    if (ticket?.status !== QueueStatus.CALLED || !ticket.grace_expires_at) {
      this.countdownSeconds.set(0);
      this.expiryRefreshKey = null;
      return;
    }

    const remaining = Math.max(
      0,
      Math.ceil(
        (new Date(ticket.grace_expires_at).getTime() -
          (Date.now() + this.serverClockOffsetMs)) /
          1000,
      ),
    );
    this.countdownSeconds.set(remaining);

    const refreshKey = `${ticket.queue_entry_id}:${ticket.grace_expires_at}`;
    if (remaining === 0 && this.expiryRefreshKey !== refreshKey) {
      this.expiryRefreshKey = refreshKey;
      this.loadQueueStatus();
    }
  }

  readonly countdownText = computed((): string => {
    const seconds = this.countdownSeconds();
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  });
  readonly isGracePeriodUrgent = computed(
    (): boolean =>
      this.currentTicket()?.status === QueueStatus.CALLED &&
      this.countdownSeconds() <= 30,
  );
  readonly isCalled = computed(
    (): boolean => this.currentTicket()?.status === QueueStatus.CALLED,
  );
  readonly isInService = computed(
    (): boolean => this.currentTicket()?.status === QueueStatus.IN_SERVICE,
  );

  // Opens the call next dialog with the room and practitioner prefilled.
  onCallNext(): void {
    this.callNextForm.reset({
      roomNumber: `${ROOM_PREFIX} ${this.counterNumber()}`,
      practitionerName:
        this.authService.currentUser()?.fullName ?? DEFAULT_PRACTITIONER_NAME,
    });
    this.callNextError.set(null);
    this.isCallNextDialogOpen.set(true);
  }

  onCancelCallNext(): void {
    this.isCallNextDialogOpen.set(false);
  }

  onCallNextVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.onCancelCallNext();
    }
  }

  onConfirmCallNext(): void {
    if (this.callNextForm.invalid) {
      this.callNextForm.markAllAsTouched();
      return;
    }

    const formValue = this.callNextForm.getRawValue();
    this.isGeneratingQueue.set(true);
    this.callNextError.set(null);

    this.queueService
      .callNext(this.queueId(), {
        roomNumber: formValue.roomNumber.trim(),
        // TODO(Lim, Jereign): confirm with Sabino whether this should be a
        // user id or a name
        practitionerId: formValue.practitionerName.trim(),
      })
      .subscribe({
        next: (response): void => {
          const calledTicket: ServingTicket = {
            queue_entry_id: response.queue_entry_id,
            ticket_number: response.ticket_number,
            status: response.status,
            called_at: response.called_at,
            grace_expires_at: response.grace_expires_at,
            room_number: response.room_number,
          };
          this.currentTicket.set(calledTicket);
          this.servingTicket.set(response.ticket_number);
          this.waitingCount.update((count: number): number => Math.max(0, count - 1));
          this.actionError.set(null);
          this.isCallNextDialogOpen.set(false);
          this.updateCountdown();
          this.loadQueueStatus();
        },
        error: (error: HttpErrorResponse): void => {
          this.callNextError.set(getErrorMessage(error, CALL_NEXT_ERROR));
          this.isGeneratingQueue.set(false);
          if (error.status === HTTP_CONFLICT) {
            this.loadQueueStatus();
          }
        },
        complete: (): void => {
          this.isGeneratingQueue.set(false);
        },
      });
  }

  onPatientArrived(): void {
    this.updateCurrentStatus(QueueStatus.IN_SERVICE, {
      fallbackMessage: START_ERROR,
      errorTarget: 'page',
    });
  }

  // Opens the dialog that doubles as the confirmation for completing.
  onComplete(): void {
    const ticket = this.currentTicket();
    if (!ticket) {
      return;
    }
    this.completeTicketNumber.set(ticket.ticket_number);
    this.completeNotes.reset('');
    this.completeError.set(null);
    this.isCompleteDialogOpen.set(true);
  }

  onCancelComplete(): void {
    this.isCompleteDialogOpen.set(false);
  }

  onCompleteVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.onCancelComplete();
    }
  }

  onConfirmComplete(): void {
    if (this.completeNotes.invalid) {
      this.completeNotes.markAsTouched();
      return;
    }

    const notes = this.completeNotes.value.trim();
    this.updateCurrentStatus(QueueStatus.DONE, {
      notes: notes || undefined,
      fallbackMessage: COMPLETE_ERROR,
      errorTarget: 'complete-dialog',
    });
  }

  onMarkNoShow(): void {
    this.confirmStatusChange(
      'Mark no-show',
      'Mark this ticket as a no-show?',
      QueueStatus.NO_SHOW,
      NO_SHOW_ERROR,
    );
  }

  onCancelEntry(): void {
    this.confirmStatusChange(
      'Cancel ticket',
      'Cancel this ticket?',
      QueueStatus.CANCELLED,
      CANCEL_ERROR,
    );
  }

  private confirmStatusChange(
    header: string,
    message: string,
    status: QueueStatus,
    fallbackMessage: string,
  ): void {
    this.confirmationService.confirm({
      header,
      message,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Confirm',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void =>
        this.updateCurrentStatus(status, {
          fallbackMessage,
          errorTarget: 'page',
        }),
    });
  }

  private updateCurrentStatus(
    status: QueueStatus,
    options: StatusUpdateOptions,
  ): void {
    const ticket = this.currentTicket();
    if (!ticket) {
      return;
    }

    this.isUpdatingStatus.set(true);
    this.queueService
      .updateEntryStatus(this.queueId(), ticket.queue_entry_id, {
        status,
        ...(options.notes ? { notes: options.notes } : {}),
      })
      .subscribe({
        next: (): void => {
          if (status === QueueStatus.DONE) {
            this.currentTicket.set(null);
            this.servingTicket.set('—');
            this.completedCount.update((count: number): number => count + 1);
            this.isCompleteDialogOpen.set(false);
          } else if (status === QueueStatus.IN_SERVICE) {
            this.currentTicket.update((current) =>
              current ? { ...current, status: QueueStatus.IN_SERVICE, grace_expires_at: null } : null,
            );
          }
          this.actionError.set(null);
          this.completeError.set(null);
          this.isUpdatingStatus.set(false);
          this.loadQueueStatus();
        },
        error: (error: HttpErrorResponse): void => {
          const message = getErrorMessage(error, options.fallbackMessage);
          if (options.errorTarget === 'complete-dialog') {
            this.completeError.set(message);
          } else {
            this.actionError.set(message);
          }
          this.isUpdatingStatus.set(false);
          if (error.status === HTTP_CONFLICT) {
            this.loadQueueStatus();
          }
        },
      });
  }

  appointmentStatusLabel(status: AppointmentStatus): string {
    return APPOINTMENT_STATUS_LABELS[status];
  }

  appointmentStatusSeverity(status: AppointmentStatus): AppointmentTagSeverity {
    return APPOINTMENT_STATUS_SEVERITIES[status];
  }

  appointmentTimeRange(row: StaffAppointmentRow): string {
    return (
      formatTime12h(row.startTime) +
      TIME_RANGE_SEPARATOR +
      formatTime12h(row.endTime)
    );
  }

  // TODO(Lim, Jereign): call GET /appointments (staff) again
  onRetryAppointments(): void {
    this.hasAppointmentsError.set(false);
    this.isAppointmentsLoading.set(false);
  }

  // Clears the stats error so the queue numbers can load again.
  onRetryStats(): void {
    this.hasStatsError.set(false);
    this.loadQueueStatus();
  }

}

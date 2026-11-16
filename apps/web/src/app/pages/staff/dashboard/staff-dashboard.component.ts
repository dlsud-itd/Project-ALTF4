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
import { interval, merge } from 'rxjs';
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
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
  NoticeComponent,
  NoticeVariant,
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
const RECALL_ERROR = 'Could not recall the current patient.';
const COMPLETE_ERROR = 'Could not complete the consultation.';
const NO_SHOW_ERROR = 'Could not mark the patient as no-show.';
const CANCEL_ERROR = 'Could not cancel the ticket.';
const NOTICE_DURATION_MS = 5000;
const ACTION_FAILED_MESSAGE = 'Something went wrong. Please try again.';
const NO_CURRENT_TICKET_MESSAGE = 'No patient is being called right now.';
const EMPTY_QUEUE_MESSAGE = 'The queue is empty.';
const PATIENT_ALREADY_CALLED_MESSAGE = 'A patient is already being called.';
const PATIENT_MUST_ARRIVE_MESSAGE =
  'The patient must arrive before completing consultation.';

type DashboardNotice = {
  message: string;
  variant: NoticeVariant;
};

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
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const AMBER_THRESHOLD_SECONDS = 60;
const RED_THRESHOLD_SECONDS = 15;

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
    NoticeComponent,
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
  readonly currentTicket = signal<ServingTicket | null>(null);
  readonly currentTimeMs = signal<number>(Date.now());
  readonly gracePeriodMs = signal<number>(0);
  readonly waitingCount = signal<number>(0);
  readonly waitingTickets = signal<QueueTicketSummary[]>([]);
  readonly completedCount = signal<number>(0);
  readonly noShowCount = signal<number>(0);
  readonly isGeneratingQueue = signal<boolean>(false);
  readonly isRecalling = signal<boolean>(false);
  readonly isUpdatingStatus = signal<boolean>(false);
  readonly isCallNextDialogOpen = signal<boolean>(false);
  readonly isCompleteDialogOpen = signal<boolean>(false);
  readonly isNoShowCancelEnabled = IS_NO_SHOW_CANCEL_ENABLED;
  readonly defaultNoticeVariant = NoticeVariant.INFO;
  readonly notesMaxLength = NOTES_MAX_LENGTH;
  readonly roomMaxLength = ROOM_MAX_LENGTH;
  readonly practitionerMaxLength = PRACTITIONER_MAX_LENGTH;
  readonly notice = signal<DashboardNotice | null>(null);
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
  private serverClockOffsetMs = 0;
  private expirationRequestEntryId: number | null = null;
  private noticeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.listenForSseEvents();
    interval(MILLISECONDS_PER_SECOND)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => this.refreshGracePeriod());
    this.destroyRef.onDestroy(() => this.sseService.disconnect());
    this.destroyRef.onDestroy(() => this.clearNoticeTimer());
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

    this.queueService.getStaffQueueStatus(this.queueId()).subscribe({
      next: (response: QueueStatusResponse): void => {
        const currentTicket = response.currently_serving;
        this.serverClockOffsetMs =
          new Date(response.server_time).getTime() - Date.now();
        this.currentTimeMs.set(Date.now() + this.serverClockOffsetMs);
        this.gracePeriodMs.set(response.grace_period_ms);
        this.isQueueActive.set(response.is_active);
        this.currentTicket.set(currentTicket);
        this.waitingCount.set(response.total_waiting ?? 0);
        this.waitingTickets.set(response.waiting_tickets ?? []);
        this.completedCount.set(response.total_completed_today ?? 0);
        this.noShowCount.set(response.total_no_shows_today ?? 0);
        const newlyNoShowTickets = response.newly_no_show_ticket_numbers ?? [];
        if (newlyNoShowTickets.length > 0) {
          this.showNotice(
            `${newlyNoShowTickets[newlyNoShowTickets.length - 1]} was marked as no-show.`,
            NoticeVariant.WARNING,
          );
        }
        if (
          this.expirationRequestEntryId !== null &&
          this.expirationRequestEntryId !== currentTicket?.queue_entry_id
        ) {
          this.expirationRequestEntryId = null;
        }
        this.isStatsLoading.set(false);
        this.refreshGracePeriod();
      },
      error: (error: HttpErrorResponse): void => {
        if (this.isQueueNotFound(error)) {
          this.isQueueActive.set(false);
        } else {
          console.error('Could not load queue status.', error);
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

  readonly graceRemainingSeconds = computed((): number => {
    const ticket = this.currentTicket();
    if (ticket?.status !== QueueStatus.CALLED || !ticket.called_at) {
      return 0;
    }

    const deadline =
      new Date(ticket.called_at).getTime() + this.gracePeriodMs();
    return Math.max(
      0,
      Math.ceil((deadline - this.currentTimeMs()) / MILLISECONDS_PER_SECOND),
    );
  });
  readonly graceCountdownText = computed((): string => {
    const seconds = this.graceRemainingSeconds();
    return `${String(Math.floor(seconds / SECONDS_PER_MINUTE)).padStart(2, '0')}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
  });
  readonly isGracePeriodAmber = computed(
    (): boolean =>
      this.graceRemainingSeconds() <= AMBER_THRESHOLD_SECONDS &&
      this.graceRemainingSeconds() > RED_THRESHOLD_SECONDS,
  );
  readonly isGracePeriodRed = computed(
    (): boolean =>
      this.currentTicket()?.status === QueueStatus.CALLED &&
      this.graceRemainingSeconds() <= RED_THRESHOLD_SECONDS,
  );
  readonly isCalled = computed(
    (): boolean => this.currentTicket()?.status === QueueStatus.CALLED,
  );
  readonly isInService = computed(
    (): boolean => this.currentTicket()?.status === QueueStatus.IN_SERVICE,
  );

  refreshGracePeriod(): void {
    this.currentTimeMs.set(Date.now() + this.serverClockOffsetMs);
    const ticket = this.currentTicket();
    if (
      ticket?.status !== QueueStatus.CALLED ||
      this.graceRemainingSeconds() > 0 ||
      this.expirationRequestEntryId === ticket.queue_entry_id
    ) {
      return;
    }

    this.expirationRequestEntryId = ticket.queue_entry_id;
    this.updateCurrentStatus(QueueStatus.NO_SHOW, {
      fallbackMessage: NO_SHOW_ERROR,
      errorTarget: 'page',
    });
  }

  onPatientArrived(): void {
    if (!this.currentTicket()) {
      this.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (!this.isCalled() || this.isUpdatingStatus()) {
      return;
    }

    this.updateCurrentStatus(QueueStatus.IN_SERVICE, {
      fallbackMessage: 'Could not start the consultation.',
      errorTarget: 'page',
    });
  }

  // Opens the call next dialog with the room and practitioner prefilled.
  onCallNext(): void {
    this.clearNotice();
    if (this.currentTicket()) {
      this.showNotice(PATIENT_ALREADY_CALLED_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (this.waitingCount() === 0) {
      this.showNotice(EMPTY_QUEUE_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (this.isGeneratingQueue()) {
      return;
    }

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
    if (this.isGeneratingQueue()) {
      return;
    }
    if (this.currentTicket()) {
      this.showNotice(PATIENT_ALREADY_CALLED_MESSAGE, NoticeVariant.INFO);
      this.isCallNextDialogOpen.set(false);
      return;
    }
    if (this.waitingCount() === 0) {
      this.showNotice(EMPTY_QUEUE_MESSAGE, NoticeVariant.INFO);
      this.isCallNextDialogOpen.set(false);
      return;
    }
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
            patient_name: response.patient_name,
            reason_for_visit: response.reason_for_visit,
            called_at: response.called_at,
            grace_expires_at: response.grace_expires_at,
            room_number: response.room_number,
          };
          this.gracePeriodMs.set(response.grace_period_ms);
          this.currentTicket.set(calledTicket);
          this.waitingCount.update((count: number): number =>
            Math.max(0, count - 1),
          );
          this.clearNotice();
          this.isCallNextDialogOpen.set(false);
          this.loadQueueStatus();
        },
        error: (error: HttpErrorResponse): void => {
          this.logActionError(CALL_NEXT_ERROR, error);
          this.callNextError.set(ACTION_FAILED_MESSAGE);
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

  onRecallCurrent(): void {
    if (!this.currentTicket()) {
      this.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (!this.isCalled()) {
      this.showNotice(
        'Recall is only available while waiting for the patient.',
        NoticeVariant.INFO,
      );
      return;
    }
    if (this.isRecalling()) {
      return;
    }

    this.isRecalling.set(true);
    this.queueService.recallCurrent(this.queueId()).subscribe({
      next: (): void => {
        this.isRecalling.set(false);
      },
      error: (error: HttpErrorResponse): void => {
        this.logActionError(RECALL_ERROR, error);
        this.showNotice(ACTION_FAILED_MESSAGE, NoticeVariant.ERROR);
        this.isRecalling.set(false);
        if (error.status === HTTP_CONFLICT) {
          this.loadQueueStatus();
        }
      },
    });
  }

  // Opens the dialog that doubles as the confirmation for completing.
  onComplete(): void {
    const ticket = this.currentTicket();
    if (!ticket) {
      this.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (ticket.status !== QueueStatus.IN_SERVICE) {
      this.showNotice(PATIENT_MUST_ARRIVE_MESSAGE, NoticeVariant.INFO);
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
    if (this.isUpdatingStatus()) {
      return;
    }
    if (!this.isInService()) {
      this.onComplete();
      return;
    }
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
    if (!this.isCalled()) {
      return;
    }
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
      this.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (
      (status === QueueStatus.DONE &&
        ticket.status !== QueueStatus.IN_SERVICE) ||
      (status === QueueStatus.IN_SERVICE &&
        ticket.status !== QueueStatus.CALLED) ||
      (status === QueueStatus.NO_SHOW && ticket.status !== QueueStatus.CALLED)
    ) {
      this.showNotice(
        status === QueueStatus.DONE
          ? PATIENT_MUST_ARRIVE_MESSAGE
          : NO_CURRENT_TICKET_MESSAGE,
        NoticeVariant.INFO,
      );
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
            this.completedCount.update((count: number): number => count + 1);
            this.isCompleteDialogOpen.set(false);
          } else if (status === QueueStatus.IN_SERVICE) {
            this.currentTicket.update((current) =>
              current
                ? {
                    ...current,
                    status: QueueStatus.IN_SERVICE,
                    grace_expires_at: null,
                  }
                : null,
            );
            this.expirationRequestEntryId = null;
          } else if (status === QueueStatus.NO_SHOW) {
            this.currentTicket.set(null);
            this.noShowCount.update((count: number): number => count + 1);
            this.showNotice(
              `${ticket.ticket_number} was marked as no-show.`,
              NoticeVariant.WARNING,
            );
            this.expirationRequestEntryId = null;
          }
          this.completeError.set(null);
          this.isUpdatingStatus.set(false);
          this.loadQueueStatus();
        },
        error: (error: HttpErrorResponse): void => {
          this.logActionError(options.fallbackMessage, error);
          if (
            status === QueueStatus.NO_SHOW &&
            error.status === HTTP_CONFLICT
          ) {
            this.expirationRequestEntryId = null;
            this.isUpdatingStatus.set(false);
            this.loadQueueStatus();
            return;
          }
          if (options.errorTarget === 'complete-dialog') {
            this.completeError.set(ACTION_FAILED_MESSAGE);
          } else {
            this.showNotice(ACTION_FAILED_MESSAGE, NoticeVariant.ERROR);
          }
          this.isUpdatingStatus.set(false);
          if (status === QueueStatus.NO_SHOW) {
            this.expirationRequestEntryId = null;
          }
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

  onDismissNotice(): void {
    this.clearNotice();
  }

  private showNotice(message: string, variant: NoticeVariant): void {
    this.clearNoticeTimer();
    this.notice.set({ message, variant });
    this.noticeTimeoutId = setTimeout(
      (): void => this.clearNotice(),
      NOTICE_DURATION_MS,
    );
  }

  private clearNotice(): void {
    this.clearNoticeTimer();
    this.notice.set(null);
  }

  private clearNoticeTimer(): void {
    if (this.noticeTimeoutId !== null) {
      clearTimeout(this.noticeTimeoutId);
      this.noticeTimeoutId = null;
    }
  }

  private logActionError(message: string, error: HttpErrorResponse): void {
    console.error(message, error);
  }
}

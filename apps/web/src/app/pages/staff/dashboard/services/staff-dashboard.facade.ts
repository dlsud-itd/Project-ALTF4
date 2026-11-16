import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { interval, merge } from 'rxjs';
import { AuthService, QueueService, SseService } from '@core/services';
import {
  QueueStatus,
  QueueStatusResponse,
  QueueTicketSummary,
  ServingTicket,
} from '@core/models';
import { NoticeVariant } from '@shared/ui';
import { StaffDashboardQueueActions } from './staff-dashboard-queue-actions';
import {
  SAMPLE_APPOINTMENTS,
  StaffAppointmentRow,
} from '../data/staff-dashboard.data';

const HTTP_NOT_FOUND = 404;
const NOTES_MAX_LENGTH = 500;
const ROOM_MAX_LENGTH = 60;
const PROVIDER_MAX_LENGTH = 60;
const NOTICE_DURATION_MS = 5000;

type DashboardNotice = {
  message: string;
  variant: NoticeVariant;
};

// Rejects values that are empty or only whitespace.
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length > 0 ? null : { required: true };
}
const QUEUE_NOT_FOUND_CODE = 'QUEUE_NOT_FOUND';
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const AMBER_THRESHOLD_SECONDS = 60;
const RED_THRESHOLD_SECONDS = 15;

@Injectable()
export class StaffDashboardFacade {
  private readonly authService = inject(AuthService);
  private readonly queueService = inject(QueueService);
  private readonly sseService = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
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
  readonly isStatusDialogOpen = signal<boolean>(false);
  readonly statusDialogStatus = signal<
    QueueStatus.NO_SHOW | QueueStatus.CANCELLED | null
  >(null);
  readonly defaultNoticeVariant = NoticeVariant.INFO;
  readonly notesMaxLength = NOTES_MAX_LENGTH;
  readonly roomMaxLength = ROOM_MAX_LENGTH;
  readonly providerMaxLength = PROVIDER_MAX_LENGTH;
  readonly notice = signal<DashboardNotice | null>(null);
  readonly callNextError = signal<string | null>(null);
  readonly completeError = signal<string | null>(null);
  readonly completeTicketNumber = signal<string>('');
  readonly statusDialogError = signal<string | null>(null);
  readonly statusDialogTicketNumber = signal<string>('');
  readonly callNextForm = this.formBuilder.nonNullable.group({
    room: ['', [notBlank, Validators.maxLength(ROOM_MAX_LENGTH)]],
    provider: ['', [notBlank, Validators.maxLength(PROVIDER_MAX_LENGTH)]],
  });
  readonly completeNotes = this.formBuilder.nonNullable.control('', [
    Validators.maxLength(NOTES_MAX_LENGTH),
  ]);
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
  serverClockOffsetMs = 0;
  expirationRequestEntryId: number | null = null;
  private noticeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly actions = new StaffDashboardQueueActions(
    this,
    this.authService,
    this.queueService,
  );

  initialize(): void {
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

  loadQueueStatus(): void {
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
    (): boolean => this.currentTicket()?.status === QueueStatus.IN_CONSULTATION,
  );

  refreshGracePeriod(): void {
    this.actions.refreshGracePeriod();
  }

  onPatientArrived(): void {
    this.actions.onPatientArrived();
  }

  onCallNext(): void {
    this.actions.onCallNext();
  }

  onCancelCallNext(): void {
    this.actions.onCancelCallNext();
  }

  onCallNextVisibleChange(isVisible: boolean): void {
    this.actions.onCallNextVisibleChange(isVisible);
  }

  onConfirmCallNext(): void {
    this.actions.onConfirmCallNext();
  }

  onRecallCurrent(): void {
    this.actions.onRecallCurrent();
  }

  onComplete(): void {
    this.actions.onComplete();
  }

  onCancelComplete(): void {
    this.actions.onCancelComplete();
  }

  onCompleteVisibleChange(isVisible: boolean): void {
    this.actions.onCompleteVisibleChange(isVisible);
  }

  onConfirmComplete(): void {
    this.actions.onConfirmComplete();
  }

  onMarkNoShow(): void {
    this.actions.onMarkNoShow();
  }

  onCancelEntry(): void {
    this.actions.onCancelEntry();
  }

  onCancelStatusAction(): void {
    this.actions.onCancelStatusAction();
  }

  onStatusDialogVisibleChange(isVisible: boolean): void {
    this.actions.onStatusDialogVisibleChange(isVisible);
  }

  onConfirmStatusAction(): void {
    this.actions.onConfirmStatusAction();
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

  showNotice(message: string, variant: NoticeVariant): void {
    this.clearNoticeTimer();
    this.notice.set({ message, variant });
    this.noticeTimeoutId = setTimeout(
      (): void => this.clearNotice(),
      NOTICE_DURATION_MS,
    );
  }

  clearNotice(): void {
    this.clearNoticeTimer();
    this.notice.set(null);
  }

  private clearNoticeTimer(): void {
    if (this.noticeTimeoutId !== null) {
      clearTimeout(this.noticeTimeoutId);
      this.noticeTimeoutId = null;
    }
  }
}

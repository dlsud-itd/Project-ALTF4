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
import QRCode from 'qrcode';
import { merge } from 'rxjs';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { AuthService, QueueService, SseService } from '@core/services';
import {
  AppointmentStatus,
  QueueStatus,
  QueueStatusResponse,
  QueueTicketSummary,
  ServingTicket,
  WalkInRequest,
} from '@core/models';
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
    DatePipe,
    Tag,
    ReactiveFormsModule,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './staff-dashboard.component.html',
  styleUrl: './staff-dashboard.component.scss',
})
export class StaffDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly queueService = inject(QueueService);
  private readonly sseService = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly namePattern = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
  private readonly validatePatientName = (
    control: AbstractControl<string>,
  ): ValidationErrors | null => {
    const name = control.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      return { minlength: true };
    }
    if (name.length > 60) {
      return { maxlength: true };
    }
    return this.namePattern.test(name) ? null : { pattern: true };
  };

  readonly queueId = signal<number>(1);
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
  readonly servingTicket = signal<string>('—');
  readonly currentTicket = signal<ServingTicket | null>(null);
  readonly countdownSeconds = signal<number>(0);
  private serverClockOffsetMs = 0;
  readonly waitingCount = signal<number>(0);
  readonly waitingTickets = signal<QueueTicketSummary[]>([]);
  readonly completedCount = signal<number>(0);
  readonly generatedTicket = signal<string | null>(null);
  readonly qrCodeDataUrl = signal<string | null>(null);
  readonly isGeneratingQueue = signal<boolean>(false);
  readonly walkInError = signal<string | null>(null);
  readonly walkInForm = this.formBuilder.nonNullable.group({
    name: [
      '',
      [Validators.required, this.validatePatientName],
    ],
    reasonForVisit: ['', [Validators.maxLength(200)]],
  });

  private getTrackingUrl(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
    return `${origin}/patient/queue?token=${encodeURIComponent(token)}`;
  }

  private async generateQrCode(token: string): Promise<void> {
    try {
      const trackingUrl = this.getTrackingUrl(token);
      const dataUrl = await QRCode.toDataURL(trackingUrl, {
        margin: 1,
        width: 180,
        color: {
          dark: '#0d4e52',
          light: '#ffffff',
        },
      });
      this.qrCodeDataUrl.set(dataUrl);
    } catch {
      this.qrCodeDataUrl.set(null);
    }
  }

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

  onGenerateQueueNumber(): void {
    if (this.walkInForm.invalid) {
      this.walkInForm.markAllAsTouched();
      return;
    }

    const formValue = this.walkInForm.getRawValue();
    const payload: WalkInRequest = {
      name: formValue.name.trim().replace(/\s+/g, ' '),
      reasonForVisit: formValue.reasonForVisit.trim() || undefined,
    };

    this.isGeneratingQueue.set(true);
    this.walkInError.set(null);
    this.queueService.generateStaffQueueNumber(this.queueId(), payload).subscribe({
      next: (response): void => {
        this.generatedTicket.set(response.ticket_number);
        this.qrCodeDataUrl.set(null);

        if (response.tracking_token) {
          void this.generateQrCode(response.tracking_token);
        }

        this.walkInForm.reset();
        this.loadQueueStatus();
      },
      error: (error: { error?: { message?: string | string[] } }): void => {
        const message = error.error?.message;
        this.walkInError.set(
          Array.isArray(message)
            ? message.join(', ')
            : message ?? 'Could not create the walk-in ticket.',
        );
        this.isGeneratingQueue.set(false);
      },
      complete: (): void => {
        this.isGeneratingQueue.set(false);
      },
    });
  }

  onPrintQueueTicket(): void {
    if (!this.generatedTicket()) {
      return;
    }

    const originalTitle = document.title;
    const queueNumber = this.generatedTicket();
    document.title = `ClinicQueue Ticket ${queueNumber}`;

    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = originalTitle;
      }, 200);
    }, 50);
  }

  onCallNext(): void {
    this.isGeneratingQueue.set(true);

    this.queueService
      .callNext(this.queueId(), {
        roomNumber: `Counter ${this.counterNumber()}`,
        practitionerId: this.authService.currentUser()?.id?.toString() ?? 'staff',
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
          this.updateCountdown();
          this.loadQueueStatus();
        },
        error: (): void => {
          this.hasStatsError.set(true);
        },
        complete: (): void => {
          this.isGeneratingQueue.set(false);
        },
      });
  }

  onPatientArrived(): void {
    this.updateCurrentStatus(QueueStatus.IN_SERVICE);
  }

  onComplete(): void {
    this.updateCurrentStatus(QueueStatus.DONE);
  }

  private updateCurrentStatus(status: QueueStatus): void {
    const ticket = this.currentTicket();
    if (!ticket) {
      return;
    }

    this.queueService
      .updateEntryStatus(this.queueId(), ticket.queue_entry_id, { status })
      .subscribe({
        next: (): void => {
          if (status === QueueStatus.DONE) {
            this.currentTicket.set(null);
            this.servingTicket.set('—');
            this.completedCount.update((count: number): number => count + 1);
          } else if (status === QueueStatus.IN_SERVICE) {
            this.currentTicket.update((current) =>
              current ? { ...current, status: QueueStatus.IN_SERVICE, grace_expires_at: null } : null,
            );
          }
          this.loadQueueStatus();
        },
        error: (): void => {
          this.hasStatsError.set(true);
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

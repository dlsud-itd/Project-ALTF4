import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  map,
  merge,
  of,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { QueueService, SseService } from '@core/services';
import {
  PatientQueueEntryResponse,
  QueueStatus,
  QueueStatusResponse,
  TrackingStatusResponse,
} from '@core/models';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

type TagSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

type TrackerStepState = 'done' | 'current' | 'upcoming';

export type DisplayQueueEntry = {
  ticketNumber: string;
  status: QueueStatus;
  positionInQueue: number;
  estimatedWaitMinutes: number;
  roomNumber?: string | null;
};

// Page view model mapped from the snake_case status response.
type QueueSummaryView = {
  isOpen: boolean;
  nowServing: string | null;
  roomNumber: string | null;
  patientsWaiting: number;
  lastUpdated: string;
};

const QUEUE_VIEW_STATE = {
  LOADING: 'LOADING',
  ACTIVE: 'ACTIVE',
  QUEUE_CLOSED: 'QUEUE_CLOSED',
  NO_QUEUE: 'NO_QUEUE',
  ERROR: 'ERROR',
} as const;

type QueueViewState = (typeof QUEUE_VIEW_STATE)[keyof typeof QUEUE_VIEW_STATE];

// Why a refresh was requested. Only background failures keep old data.
const REFRESH_KIND = {
  INITIAL: 'INITIAL',
  MANUAL: 'MANUAL',
  BACKGROUND: 'BACKGROUND',
} as const;

type RefreshKind = (typeof REFRESH_KIND)[keyof typeof REFRESH_KIND];

type RefreshResult = {
  kind: RefreshKind;
  response: QueueStatusResponse | null;
  error: unknown;
};

// TODO(Lim, Jereign): remove once the API provides today's queue id
const CURRENT_QUEUE_ID = 1;

// Polling fallback interval, used only while the SSE stream is offline.
const POLL_INTERVAL_MS = 15000;

const HTTP_NOT_FOUND = 404;
const QUEUE_NOT_FOUND_CODE = 'QUEUE_NOT_FOUND';
const NO_ONE_SERVING_LABEL = 'None yet';
const LOADING_LINE_COUNT = 4;
const FIRST_POSITION = 1;
const NO_PEOPLE_AHEAD = 0;

const STATUS_LABELS: Record<QueueStatus, string> = {
  [QueueStatus.WAITING]: 'Waiting',
  [QueueStatus.CALLED]: 'Called',
  [QueueStatus.IN_CONSULTATION]: 'In consultation',
  [QueueStatus.COMPLETED]: 'Completed',
  [QueueStatus.CANCELLED]: 'Cancelled',
  [QueueStatus.NO_SHOW]: 'No-show',
};

const STATUS_SEVERITIES: Record<QueueStatus, TagSeverity> = {
  [QueueStatus.WAITING]: 'warn',
  [QueueStatus.CALLED]: 'info',
  [QueueStatus.IN_CONSULTATION]: 'info',
  [QueueStatus.COMPLETED]: 'success',
  [QueueStatus.CANCELLED]: 'danger',
  [QueueStatus.NO_SHOW]: 'secondary',
};

// Ordered steps of a normal visit, shown in the progress tracker.
const TRACKER_STEPS: readonly QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_CONSULTATION,
  QueueStatus.COMPLETED,
];

const TERMINAL_STATUSES: readonly QueueStatus[] = [
  QueueStatus.CANCELLED,
  QueueStatus.NO_SHOW,
];

// Maps the API response to the view model. Only whitelisted fields are used.
function toSummaryView(response: QueueStatusResponse): QueueSummaryView {
  return {
    isOpen: response.is_active,
    nowServing: response.currently_serving?.ticket_number ?? null,
    roomNumber: response.currently_serving?.room_number ?? null,
    patientsWaiting: response.total_waiting,
    lastUpdated: response.last_updated,
  };
}

// True for a 404 whose message carries the QUEUE_NOT_FOUND code.
function isQueueNotFound(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }
  const body = error.error as { message?: unknown } | null;
  return (
    error.status === HTTP_NOT_FOUND &&
    typeof body?.message === 'string' &&
    body.message.includes(QUEUE_NOT_FOUND_CODE)
  );
}

// Patient virtual queue screen: ticket, position, wait and queue summary.
@Component({
  selector: 'app-patient-queue',
  standalone: true,
  imports: [
    Button,
    Tag,
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './queue.component.html',
  styleUrl: './queue.component.scss',
})
export class PatientQueueComponent implements OnInit {
  private readonly queueService = inject(QueueService);
  private readonly sseService = inject(SseService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<RefreshKind>();

  readonly loadingLineCount = LOADING_LINE_COUNT;

  readonly viewState = signal<QueueViewState>(QUEUE_VIEW_STATE.LOADING);
  readonly summary = signal<QueueSummaryView | null>(null);
  readonly isLive = signal(false);
  readonly isRefreshing = signal(false);

  // Connected to live backend queue entry
  readonly entry = signal<DisplayQueueEntry | null>(null);

  readonly hasDuplicateEntry = signal(false);

  readonly isLoading = computed(
    () => this.viewState() === QUEUE_VIEW_STATE.LOADING,
  );
  readonly hasError = computed(
    () => this.viewState() === QUEUE_VIEW_STATE.ERROR,
  );
  readonly hasNoQueue = computed(
    () => this.viewState() === QUEUE_VIEW_STATE.NO_QUEUE,
  );
  readonly isQueueClosed = computed(
    () => this.viewState() === QUEUE_VIEW_STATE.QUEUE_CLOSED,
  );
  readonly isActive = computed(
    () => this.viewState() === QUEUE_VIEW_STATE.ACTIVE,
  );

  readonly nowServingLabel = computed(
    () => this.summary()?.nowServing ?? NO_ONE_SERVING_LABEL,
  );

  readonly hasEntry = computed(() => this.entry() !== null);

  readonly statusLabel = computed(() => {
    const entry = this.entry();
    return entry ? STATUS_LABELS[entry.status] : '';
  });

  readonly statusSeverity = computed<TagSeverity>(() => {
    const entry = this.entry();
    return entry ? STATUS_SEVERITIES[entry.status] : 'secondary';
  });

  readonly peopleAhead = computed(() => {
    const entry = this.entry();
    return entry
      ? Math.max(entry.positionInQueue - FIRST_POSITION, 0)
      : NO_PEOPLE_AHEAD;
  });

  readonly isTerminal = computed(() => {
    const entry = this.entry();
    return entry ? TERMINAL_STATUSES.includes(entry.status) : false;
  });

  readonly isWaiting = computed(
    () => this.entry()?.status === QueueStatus.WAITING,
  );

  readonly isNextInLine = computed(
    () => this.isWaiting() && this.peopleAhead() === NO_PEOPLE_AHEAD,
  );

  readonly trackerSteps = computed(() => {
    const status = this.entry()?.status;
    if (!status) {
      return [];
    }
    const activeIndex = TRACKER_STEPS.indexOf(status);
    const isFinished = status === QueueStatus.COMPLETED;

    return TRACKER_STEPS.map((step, index) => {
      let state: TrackerStepState = 'upcoming';
      if (isFinished || index < activeIndex) {
        state = 'done';
      } else if (index === activeIndex) {
        state = 'current';
      }
      return { label: STATUS_LABELS[step], state };
    });
  });

  ngOnInit(): void {
    this.listenForRefreshes();
    this.listenForSseEvents();
    this.pollWhileOffline();
    this.loadEntry();

    this.destroyRef.onDestroy(() => this.sseService.disconnect());

    this.sseService.subscribeToQueue(CURRENT_QUEUE_ID);
    this.refresh(REFRESH_KIND.INITIAL);
  }

  loadEntry(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.queueService.trackByToken(token).subscribe({
        next: (res: TrackingStatusResponse) => {
          this.entry.set({
            ticketNumber: res.ticket_number,
            status: res.status,
            positionInQueue: res.position_in_queue,
            estimatedWaitMinutes: res.time_remaining_seconds
              ? Math.ceil(res.time_remaining_seconds / 60)
              : res.position_in_queue * 15,
          });
        },
        error: () => {
          this.entry.set(null);
        },
      });
      return;
    }

    // Authenticated patient lookup
    this.queueService.getMyQueueEntry(CURRENT_QUEUE_ID).subscribe({
      next: (entry: PatientQueueEntryResponse | null) => {
        if (entry) {
          this.entry.set({
            ticketNumber: entry.ticket_number,
            status: entry.status,
            positionInQueue: entry.position_in_queue,
            estimatedWaitMinutes: entry.estimated_wait_minutes,
            roomNumber: entry.room_number,
          });
        } else {
          this.entry.set(null);
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.hasDuplicateEntry.set(true);
        } else {
          this.entry.set(null);
        }
      },
    });
  }

  onRefresh(): void {
    this.loadEntry();
    this.refresh(REFRESH_KIND.MANUAL);
  }

  onRetry(): void {
    this.loadEntry();
    this.refresh(REFRESH_KIND.MANUAL);
  }

  // Latest request wins: switchMap cancels any fetch still in flight.
  private listenForRefreshes(): void {
    this.refresh$
      .pipe(
        switchMap((kind) =>
          this.queueService.getQueueStatus(CURRENT_QUEUE_ID).pipe(
            map((response): RefreshResult => ({ kind, response, error: null })),
            catchError((error: unknown) =>
              of<RefreshResult>({ kind, response: null, error }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.applyResult(result));
  }

  // Events are only a refetch trigger. Their payloads are never read, so
  // personal data such as patientName can never reach the page.
  private listenForSseEvents(): void {
    merge(this.sseService.queueUpdated$, this.sseService.queueCalled$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadEntry();
        this.refresh(REFRESH_KIND.BACKGROUND);
      });
  }

  // Polling fallback: the timer exists only while the stream is offline.
  private pollWhileOffline(): void {
    this.sseService.connected$
      .pipe(
        tap((isConnected) => this.isLive.set(isConnected)),
        switchMap((isConnected) =>
          isConnected ? EMPTY : timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.refresh(REFRESH_KIND.BACKGROUND));
  }

  private refresh(kind: RefreshKind): void {
    if (kind !== REFRESH_KIND.BACKGROUND) {
      this.isRefreshing.set(true);
      if (!this.isShowingData()) {
        this.viewState.set(QUEUE_VIEW_STATE.LOADING);
      }
    }
    this.refresh$.next(kind);
  }

  private isShowingData(): boolean {
    return this.isActive() || this.isQueueClosed();
  }

  private applyResult(result: RefreshResult): void {
    this.isRefreshing.set(false);

    if (result.response) {
      const view = toSummaryView(result.response);
      this.summary.set(view);
      this.viewState.set(
        view.isOpen ? QUEUE_VIEW_STATE.ACTIVE : QUEUE_VIEW_STATE.QUEUE_CLOSED,
      );
      return;
    }

    const hasStaleData = this.summary() !== null;
    if (result.kind === REFRESH_KIND.BACKGROUND && hasStaleData) {
      return;
    }

    this.viewState.set(
      isQueueNotFound(result.error)
        ? QUEUE_VIEW_STATE.NO_QUEUE
        : QUEUE_VIEW_STATE.ERROR,
    );
  }
}

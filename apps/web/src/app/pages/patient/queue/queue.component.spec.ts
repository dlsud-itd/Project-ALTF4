import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { computed, Signal, signal, WritableSignal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  PatientAppointment,
  QueueStatus,
  QueueStatusResponse,
} from '@core/models';
import { PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS } from '@core/config/clinic.constants';
import {
  ApiConfigService,
  QueueCalledEvent,
  PatientAppointmentsStore,
  QueueUpdatedEvent,
  selectActiveQueueEntry,
  SseService,
} from '@core/services';
import { PatientQueueComponent } from './queue.component';

const QUEUE_ID = 1;
const SERVER_ERROR = { status: 500, statusText: 'Server Error' };
const NEXT_IN_LINE_TEXT =
  'One of your tickets is next in line. Please head to the clinic.';
const PRIVATE_NAME = 'Jane Secret';
const PRIVATE_PHONE = '09171234567';
const PRIVATE_EXTRA = 'Other Patient Notes';

type TicketEntry = NonNullable<ReturnType<PatientQueueComponent['entry']>>;

// Stand-in for SseService: no EventSource, events pushed from the tests.
class FakeSseService {
  readonly connected = new BehaviorSubject<boolean>(false);
  readonly called = new Subject<QueueCalledEvent>();
  readonly updated = new Subject<QueueUpdatedEvent>();

  readonly subscribeToQueue = jasmine.createSpy('subscribeToQueue');
  readonly disconnect = jasmine.createSpy('disconnect');

  get connected$() {
    return this.connected.asObservable();
  }

  get queueCalled$() {
    return this.called.asObservable();
  }

  get queueUpdated$() {
    return this.updated.asObservable();
  }
}

const buildStatus = (
  overrides: Partial<QueueStatusResponse> = {},
): QueueStatusResponse => ({
  queue_id: QUEUE_ID,
  clinic_date: '2026-11-04',
  is_active: true,
  currently_serving: {
    queue_entry_id: 1,
    ticket_number: 'A-011',
    status: QueueStatus.CALLED,
    called_at: '2026-11-04T02:30:00.000Z',
    grace_expires_at: '2026-11-04T02:33:00.000Z',
    room_number: 'Counter 2',
    provider: 'Dr. Ana Santos',
  },
  total_waiting: 5,
  waiting_tickets: [],
  total_completed_today: 9,
  total_no_shows_today: 0,
  grace_period_ms: 180_000,
  newly_no_show_ticket_numbers: [],
  avg_wait_time_minutes: 5,
  server_time: '2026-11-04T02:42:00.000Z',
  last_updated: '2026-11-04T02:42:00.000Z',
  ...overrides,
});

describe('PatientQueueComponent', () => {
  let component: PatientQueueComponent;
  let fixture: ComponentFixture<PatientQueueComponent>;
  let http: HttpTestingController;
  let sse: FakeSseService;
  let statusUrl: string;
  let todayQueueUrl: string;
  let patientAppointments: WritableSignal<PatientAppointment[]>;
  let appointmentsStore: {
    appointments: WritableSignal<PatientAppointment[]>;
    isLoading: WritableSignal<boolean>;
    error: WritableSignal<string | null>;
    activeQueueEntry: Signal<PatientAppointment | null>;
    load: jasmine.Spy;
    refresh: jasmine.Spy;
  };

  const getElement = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const getText = (): string => getElement().textContent ?? '';

  const normalizedText = (): string => getText().replace(/\s+/g, ' ');

  const setEntryValue = (entry: TicketEntry | null): void => {
    patientAppointments.set(
      entry
        ? [
            {
              id: 1,
              status: 'BOOKED',
              createdAt: '2026-11-01T00:00:00.000Z',
              slot: {
                id: 1,
                clinicDate: '2026-11-04',
                startTime: '10:00',
                endTime: '10:30',
                capacity: 1,
                remainingCapacity: 0,
                isBookable: true,
                isExpired: false,
              },
              reservedQueueEntry: {
                ticketNumber: entry.ticketNumber,
                queueNumber: 14,
                status: entry.status,
                positionInQueue: entry.positionInQueue,
                estimatedWaitMinutes: entry.estimatedWaitMinutes,
              },
            },
          ]
        : [],
    );
    fixture.detectChanges();
  };

  const setEntry = (patch: Partial<TicketEntry>): void => {
    const current = component.entry();
    if (!current) {
      return;
    }
    setEntryValue({ ...current, ...patch });
  };

  const expectStatusRequest = (): TestRequest => {
    http.expectOne(todayQueueUrl).flush({
      id: QUEUE_ID,
      clinic_date: '2026-11-04',
      is_open: true,
      fallback_service_minutes: 15,
    });
    return http.expectOne(statusUrl);
  };

  const flushStatus = (overrides: Partial<QueueStatusResponse> = {}): void => {
    expectStatusRequest().flush(buildStatus(overrides));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    sse = new FakeSseService();
    patientAppointments = signal<PatientAppointment[]>([]);
    appointmentsStore = {
      appointments: patientAppointments,
      isLoading: signal(false),
      error: signal<string | null>(null),
      activeQueueEntry: computed(() =>
        selectActiveQueueEntry(patientAppointments()),
      ),
      load: jasmine.createSpy('load'),
      refresh: jasmine.createSpy('refresh'),
    };

    await TestBed.configureTestingModule({
      imports: [PatientQueueComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SseService, useValue: sse },
        { provide: PatientAppointmentsStore, useValue: appointmentsStore },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const apiUrl = TestBed.inject(ApiConfigService).apiUrl;
    statusUrl = `${apiUrl}/queues/${QUEUE_ID}/status`;
    todayQueueUrl = `${apiUrl}/queues/today`;
    fixture = TestBed.createComponent(PatientQueueComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  describe('ticket card (sample data)', () => {
    beforeEach(() => {
      setEntryValue({
        ticketNumber: 'A-014',
        status: QueueStatus.WAITING,
        positionInQueue: 3,
        estimatedWaitMinutes: 15,
      });
      fixture.detectChanges();
      flushStatus();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should render the header band title', () => {
      expect(getElement().querySelector('.page-top h2')?.textContent).toContain(
        'Your Queue',
      );
    });

    it('should show ticket number, position, wait and status', () => {
      const { ticketNumber, positionInQueue, estimatedWaitMinutes } =
        component.entry() as TicketEntry;

      expect(getText()).toContain(ticketNumber);
      expect(
        getElement().querySelector('.position-value')?.textContent,
      ).toContain(String(positionInQueue));
      expect(getElement().querySelector('.wait-value')?.textContent).toContain(
        String(estimatedWaitMinutes),
      );
      expect(
        getElement().querySelector('.entry-status')?.textContent,
      ).toContain('Waiting');
    });

    it('should render every active ticket and highlight the ticket currently being served', () => {
      patientAppointments.set([
        {
          ...patientAppointments()[0],
          reservedQueueEntries: [
            {
              id: 1,
              ticketNumber: 'A-011',
              queueNumber: 11,
              status: QueueStatus.CALLED,
              positionInQueue: 1,
              estimatedWaitMinutes: 0,
            },
            {
              id: 14,
              ticketNumber: 'A-014',
              queueNumber: 14,
              status: QueueStatus.WAITING,
              positionInQueue: 3,
              estimatedWaitMinutes: 30,
            },
            {
              id: 15,
              ticketNumber: 'A-015',
              queueNumber: 15,
              status: QueueStatus.COMPLETED,
              positionInQueue: 1,
              estimatedWaitMinutes: 0,
            },
          ],
        },
      ]);
      fixture.detectChanges();

      expect(getElement().querySelectorAll('.ticket-card').length).toBe(2);
      expect(getText()).toContain('A-011');
      expect(getText()).toContain('A-014');
      expect(getText()).not.toContain('A-015');
      expect(
        getElement().querySelector('.ticket-card.currently-serving')
          ?.textContent,
      ).toContain('A-011');
      expect(
        getElement().querySelector('.ticket-card.currently-serving')
          ?.textContent,
      ).toContain('Now serving');
    });

    it('should compute people ahead from the position', () => {
      setEntry({ positionInQueue: 1 });
      expect(component.peopleAhead()).toBe(0);

      setEntry({ positionInQueue: 4 });
      expect(component.peopleAhead()).toBe(3);
    });

    it('should render four tracker steps with one current step', () => {
      const element = getElement();

      expect(element.querySelectorAll('.tracker-step').length).toBe(4);
      expect(element.querySelectorAll('.tracker-step.current').length).toBe(1);
      expect(element.querySelectorAll('.tracker-step.done').length).toBe(0);
    });

    it('should use the display labels in the tracker', () => {
      const labels = Array.from(
        getElement().querySelectorAll('.step-label'),
      ).map((label) => label.textContent?.trim());

      expect(labels).toEqual([
        'Waiting',
        'Called',
        'In consultation',
        'Completed',
      ]);
    });

    it('should use the display label for each status', () => {
      const expected: [QueueStatus, string][] = [
        [QueueStatus.WAITING, 'Waiting'],
        [QueueStatus.CALLED, 'Called'],
        [QueueStatus.IN_CONSULTATION, 'In consultation'],
        [QueueStatus.COMPLETED, 'Completed'],
        [QueueStatus.CANCELLED, 'Cancelled'],
        [QueueStatus.NO_SHOW, 'No-show'],
      ];

      for (const [status, label] of expected) {
        const entry = component.entry() as TicketEntry;
        expect(component.statusLabelFor({ ...entry, status })).toBe(label);
      }
    });

    it('should hide completed tickets from the active view', () => {
      setEntry({ status: QueueStatus.COMPLETED });

      expect(component.entries().length).toBe(0);
      expect(getElement().querySelector('.ticket-card')).toBeNull();
    });

    it('should hide cancelled and no-show tickets from the active view', () => {
      for (const status of [QueueStatus.CANCELLED, QueueStatus.NO_SHOW]) {
        setEntryValue({
          ticketNumber: 'A-014',
          status: QueueStatus.WAITING,
          positionInQueue: 3,
          estimatedWaitMinutes: 15,
        });
        setEntry({ status });

        expect(component.entries().length).toBe(0);
        expect(getElement().querySelector('.ticket-card')).toBeNull();
      }
    });
  });

  describe('queue summary', () => {
    beforeEach(() => {
      setEntryValue({
        ticketNumber: 'A-014',
        status: QueueStatus.WAITING,
        positionInQueue: 3,
        estimatedWaitMinutes: 15,
      });
    });

    it('should show the loading skeleton while the request is pending', () => {
      fixture.detectChanges();

      expect(getElement().querySelector('app-loading-skeleton')).toBeTruthy();
      expect(component.isLoading()).toBeTrue();
      expectStatusRequest();
    });

    it('should show real data after a successful load', () => {
      fixture.detectChanges();
      flushStatus();

      const element = getElement();
      expect(component.isActive()).toBeTrue();
      expect(element.querySelector('app-loading-skeleton')).toBeNull();
      expect(element.querySelector('.now-serving')?.textContent).toContain(
        'A-011',
      );
      expect(element.querySelector('.patients-waiting')?.textContent).toContain(
        '5',
      );
      expect(element.querySelector('.last-updated')?.textContent).toContain(
        'As of',
      );
      expect(getText()).toContain('Counter 2');
    });

    it('should show a placeholder when nobody is being served', () => {
      fixture.detectChanges();
      flushStatus({ currently_serving: null });

      expect(getElement().querySelector('.now-serving')?.textContent).toContain(
        'None yet',
      );
    });

    it('should show the closed state when the queue is not active', () => {
      fixture.detectChanges();
      flushStatus({ is_active: false });

      expect(component.isQueueClosed()).toBeTrue();
      expect(getText()).toContain('The queue is closed');
      expect(getElement().querySelector('.summary-list')).toBeNull();
    });

    it('should show "No queue is open today" on QUEUE_NOT_FOUND', () => {
      fixture.detectChanges();
      expectStatusRequest().flush(
        {
          statusCode: 404,
          message: 'QUEUE_NOT_FOUND: The target queue session was not found.',
        },
        { status: 404, statusText: 'Not Found' },
      );
      fixture.detectChanges();

      expect(component.hasNoQueue()).toBeTrue();
      expect(getText()).toContain('No queue is open today');
      expect(getElement().querySelector('app-error-state')).toBeNull();
    });

    it('should show the error state for any other failure', () => {
      fixture.detectChanges();
      expectStatusRequest().flush(null, SERVER_ERROR);
      fixture.detectChanges();

      expect(component.hasError()).toBeTrue();
      expect(getElement().querySelector('app-error-state')).toBeTruthy();
    });

    it('should recover when retry succeeds', () => {
      fixture.detectChanges();
      expectStatusRequest().flush(null, SERVER_ERROR);
      fixture.detectChanges();

      const retryButton = getElement().querySelector(
        'app-error-state button',
      ) as HTMLButtonElement;
      retryButton.click();
      fixture.detectChanges();
      expect(component.isLoading()).toBeTrue();

      flushStatus();
      expect(component.isActive()).toBeTrue();
      expect(getElement().querySelector('app-error-state')).toBeNull();
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      setEntryValue({
        ticketNumber: 'A-014',
        status: QueueStatus.WAITING,
        positionInQueue: 3,
        estimatedWaitMinutes: 15,
      });
      fixture.detectChanges();
      flushStatus();
    });

    it('should refetch when the Refresh button is clicked', () => {
      const button = getElement().querySelector(
        '.refresh-button button',
      ) as HTMLButtonElement;
      button.click();

      flushStatus({ total_waiting: 8 });
      expect(
        getElement().querySelector('.patients-waiting')?.textContent,
      ).toContain('8');
    });

    it('should show the error state when a manual refresh fails', () => {
      component.onRefresh();
      expectStatusRequest().flush(null, SERVER_ERROR);
      fixture.detectChanges();

      expect(component.hasError()).toBeTrue();
    });

    it('should refetch on a queue:updated event', () => {
      sse.updated.next({
        queueId: QUEUE_ID,
        status: 'WAITING',
        totalWaiting: 6,
        timestamp: '2026-11-04T02:43:00.000Z',
      });

      flushStatus({ total_waiting: 6 });
      expect(
        getElement().querySelector('.patients-waiting')?.textContent,
      ).toContain('6');
    });

    it('should refetch on a queue:called event', () => {
      sse.called.next({
        queueId: QUEUE_ID,
        queueEntryId: 3,
        ticketNumber: 'A-012',
        roomNumber: 'Counter 2',
        calledAt: '2026-11-04T02:44:00.000Z',
      });

      flushStatus({
        currently_serving: {
          queue_entry_id: 3,
          ticket_number: 'A-012',
          status: QueueStatus.CALLED,
          called_at: '2026-11-04T02:44:00.000Z',
          grace_expires_at: '2026-11-04T02:47:00.000Z',
          room_number: 'Counter 2',
        },
      });
      expect(getElement().querySelector('.now-serving')?.textContent).toContain(
        'A-012',
      );
    });

    it('should not display personal data from a called event', () => {
      sse.called.next({
        queueId: QUEUE_ID,
        queueEntryId: 3,
        ticketNumber: 'A-012',
        roomNumber: 'Counter 2',
        calledAt: '2026-11-04T02:44:00.000Z',
      });
      flushStatus();

      expect(getText()).not.toContain('Jane Secret');
    });

    it('should keep the last good data when a background refresh fails', () => {
      sse.updated.next({
        queueId: QUEUE_ID,
        status: 'WAITING',
        totalWaiting: 6,
        timestamp: '2026-11-04T02:43:00.000Z',
      });
      expectStatusRequest().flush(null, SERVER_ERROR);
      fixture.detectChanges();

      expect(component.isActive()).toBeTrue();
      expect(
        getElement().querySelector('.patients-waiting')?.textContent,
      ).toContain('5');
    });
  });

  describe('live pill and polling', () => {
    it('should start the SSE subscription for the queue', () => {
      fixture.detectChanges();
      flushStatus();

      expect(sse.subscribeToQueue).toHaveBeenCalledWith(QUEUE_ID);
    });

    it('should show Live or Offline from the SSE connection', () => {
      fixture.detectChanges();
      flushStatus();
      expect(getElement().querySelector('.live-pill')?.textContent).toContain(
        'Offline',
      );

      sse.connected.next(true);
      fixture.detectChanges();
      expect(getElement().querySelector('.live-pill')?.textContent).toContain(
        'Live',
      );
    });

    it('should poll while SSE is offline', fakeAsync(() => {
      fixture.detectChanges();
      flushStatus();

      tick(PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS);
      flushStatus();
      expect(component.isActive()).toBeTrue();

      tick(PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS);
      flushStatus();
      expect(component.isActive()).toBeTrue();

      fixture.destroy();
      discardPeriodicTasks();
    }));

    it('should not poll while SSE is connected', fakeAsync(() => {
      sse.connected.next(true);
      fixture.detectChanges();
      flushStatus();

      tick(PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS * 3);
      http.expectNone(todayQueueUrl);
      expect(http.match(statusUrl).length).toBe(0);
    }));

    it('should stop polling once SSE reconnects', fakeAsync(() => {
      fixture.detectChanges();
      flushStatus();

      tick(PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS);
      flushStatus();

      sse.connected.next(true);
      tick(PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS * 3);
      http.expectNone(todayQueueUrl);
      expect(http.match(statusUrl).length).toBe(0);
    }));

    it('should refresh the patient ticket list periodically while SSE is connected', fakeAsync(() => {
      fixture.detectChanges();
      flushStatus();
      sse.connected.next(true);
      const refreshCount = appointmentsStore.refresh.calls.count();

      tick(PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS);

      expect(appointmentsStore.refresh).toHaveBeenCalledTimes(refreshCount + 1);
      fixture.destroy();
      discardPeriodicTasks();
    }));
  });

  describe('cleanup', () => {
    it('should disconnect SSE and stop reacting on destroy', () => {
      fixture.detectChanges();
      flushStatus();

      fixture.destroy();
      expect(sse.disconnect).toHaveBeenCalled();

      sse.updated.next({
        queueId: QUEUE_ID,
        status: 'WAITING',
        totalWaiting: 1,
        timestamp: '2026-11-04T02:45:00.000Z',
      });
      http.expectNone(statusUrl);
    });
  });

  describe('no entry state', () => {
    beforeEach(() => {
      fixture.detectChanges();
      flushStatus();
      setEntryValue(null);
      fixture.detectChanges();
    });

    it('should replace the ticket card with the empty state', () => {
      expect(getElement().querySelector('.ticket-card')).toBeNull();
      expect(normalizedText()).toContain('You are not in the queue');
      expect(normalizedText()).toContain(
        'You can join the queue on the day of your appointment.',
      );
    });

    it('should link to bookings and offer no join button', () => {
      const element = getElement();
      const link = element.querySelector('.bookings-link');
      const buttons = Array.from(element.querySelectorAll('button'));
      const hasJoin = buttons.some((b) => /join/i.test(b.textContent ?? ''));

      expect(link?.getAttribute('href')).toBe('/patient/bookings');
      expect(hasJoin).toBeFalse();
    });

    it('should hide the summary card when not in queue', () => {
      expect(getElement().querySelector('.summary-card')).toBeNull();
    });

    it('should show queue guide cards to utilize space when not in queue', () => {
      expect(getElement().querySelector('.queue-guide-grid')).toBeTruthy();
      expect(normalizedText()).toContain('How Queueing Works');
      expect(normalizedText()).toContain('Clinic Guidelines');
    });
  });

  describe('banners', () => {
    beforeEach(() => {
      setEntryValue({
        ticketNumber: 'A-014',
        status: QueueStatus.WAITING,
        positionInQueue: 3,
        estimatedWaitMinutes: 15,
      });
      fixture.detectChanges();
      flushStatus();
    });

    it('should hide the next-in-line banner by default', () => {
      expect(getElement().querySelector('.next-banner')).toBeNull();
    });

    it('should show the next-in-line banner when waiting and first', () => {
      setEntry({ positionInQueue: 1 });

      expect(getElement().querySelector('.next-banner')).toBeTruthy();
      expect(normalizedText()).toContain(NEXT_IN_LINE_TEXT);
    });

    it('should hide the next-in-line banner when not waiting', () => {
      setEntry({ positionInQueue: 1, status: QueueStatus.CALLED });

      expect(getElement().querySelector('.next-banner')).toBeNull();
    });

    it('should hide the next-in-line banner when there is no entry', () => {
      setEntryValue(null);

      expect(getElement().querySelector('.next-banner')).toBeNull();
    });
  });

  describe('privacy', () => {
    const withPrivateFields = <T extends object>(base: T): T =>
      ({
        ...base,
        patientName: PRIVATE_NAME,
        patient_name: PRIVATE_NAME,
        phone: PRIVATE_PHONE,
        phoneNumber: PRIVATE_PHONE,
        notes: PRIVATE_EXTRA,
      }) as T;

    const expectNothingPrivate = (): void => {
      const html = getElement().innerHTML;

      for (const value of [PRIVATE_NAME, PRIVATE_PHONE, PRIVATE_EXTRA]) {
        expect(html).not.toContain(value);
      }
    };

    it('should not render private fields from the API response', () => {
      fixture.detectChanges();
      const serving = {
        ticket_number: 'A-011',
        called_at: '2026-11-04T02:30:00.000Z',
        room_number: 'Counter 2',
      };
      expectStatusRequest().flush(
        withPrivateFields({
          ...buildStatus(),
          currently_serving: withPrivateFields(serving),
          entries: [withPrivateFields({ ticket_number: 'A-099' })],
        }),
      );
      fixture.detectChanges();

      expectNothingPrivate();
      expect(getText()).not.toContain('A-099');
    });

    it('should not render private fields from SSE payloads', () => {
      fixture.detectChanges();
      flushStatus();

      sse.called.next(
        withPrivateFields({
          queueId: QUEUE_ID,
          queueEntryId: 3,
          ticketNumber: 'A-099',
          patientName: PRIVATE_NAME,
          roomNumber: 'Counter 9',
          calledAt: '2026-11-04T02:44:00.000Z',
        }),
      );
      flushStatus();
      sse.updated.next(
        withPrivateFields({
          queueId: QUEUE_ID,
          ticketNumber: 'A-098',
          status: 'WAITING',
          totalWaiting: 7,
          timestamp: '2026-11-04T02:45:00.000Z',
        }),
      );
      flushStatus();

      expectNothingPrivate();
      expect(getText()).not.toContain('A-099');
      expect(getText()).not.toContain('A-098');
      expect(getText()).not.toContain('Counter 9');
    });

    it('should show only the whitelisted summary fields', () => {
      setEntryValue({
        ticketNumber: 'A-014',
        status: QueueStatus.WAITING,
        positionInQueue: 3,
        estimatedWaitMinutes: 15,
      });
      fixture.detectChanges();
      flushStatus();

      const summary = normalizedText().split('Queue Summary')[1] ?? '';
      expect(summary).toContain('A-011');
      expect(summary).toContain('Counter 2');
      expect(summary).toContain('5');
      expect(summary).toContain('As of');
      expect(summary).not.toContain('9');
    });

    it('should never log payloads to the console', () => {
      const spies = (['log', 'info', 'debug'] as const).map((method) =>
        spyOn(console, method),
      );

      fixture.detectChanges();
      flushStatus();
      sse.updated.next({
        queueId: QUEUE_ID,
        status: 'WAITING',
        totalWaiting: 6,
        timestamp: '2026-11-04T02:43:00.000Z',
      });
      flushStatus();
      component.onRefresh();
      expectStatusRequest().flush(null, SERVER_ERROR);

      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it('should announce banners and state messages as status', () => {
      setEntryValue({
        ticketNumber: 'A-001',
        status: QueueStatus.WAITING,
        positionInQueue: 1,
        estimatedWaitMinutes: 5,
      });
      fixture.detectChanges();
      expect(
        getElement().querySelector('[role="status"] app-loading-skeleton'),
      ).toBeTruthy();
      flushStatus();

      expect(
        getElement().querySelector('.next-banner')?.getAttribute('role'),
      ).toBe('status');

      setEntryValue(null);
      expect(
        getElement().querySelector('app-empty-state [role="status"]'),
      ).toBeTruthy();

      setEntryValue({
        ticketNumber: 'A-001',
        status: QueueStatus.WAITING,
        positionInQueue: 1,
        estimatedWaitMinutes: 5,
      });
      component.onRefresh();
      flushStatus({ is_active: false });
      expect(
        getElement().querySelector('.closed-note')?.getAttribute('role'),
      ).toBe('status');
    });
  });
});

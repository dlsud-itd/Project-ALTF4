import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { QueueStatus, QueueStatusResponse } from '@core/models';
import {
  ApiConfigService,
  QueueCalledEvent,
  QueueUpdatedEvent,
  SseService,
} from '@core/services';
import { PatientQueueComponent } from './queue.component';

const QUEUE_ID = 1;
const POLL_INTERVAL_MS = 15000;
const SERVER_ERROR = { status: 500, statusText: 'Server Error' };

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
    ticket_number: 'A-011',
    called_at: '2026-11-04T02:30:00.000Z',
    room_number: 'Counter 2',
  },
  total_waiting: 5,
  total_completed_today: 9,
  avg_wait_time_minutes: 5,
  last_updated: '2026-11-04T02:42:00.000Z',
  ...overrides,
});

describe('PatientQueueComponent', () => {
  let component: PatientQueueComponent;
  let fixture: ComponentFixture<PatientQueueComponent>;
  let http: HttpTestingController;
  let sse: FakeSseService;
  let statusUrl: string;

  const getElement = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const getText = (): string => getElement().textContent ?? '';

  const expectStatusRequest = (): TestRequest => http.expectOne(statusUrl);

  const flushStatus = (overrides: Partial<QueueStatusResponse> = {}): void => {
    expectStatusRequest().flush(buildStatus(overrides));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    sse = new FakeSseService();

    await TestBed.configureTestingModule({
      imports: [PatientQueueComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SseService, useValue: sse },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const apiUrl = TestBed.inject(ApiConfigService).apiUrl;
    statusUrl = `${apiUrl}/queues/${QUEUE_ID}/status`;
    fixture = TestBed.createComponent(PatientQueueComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  describe('ticket card (sample data)', () => {
    beforeEach(() => {
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

    it('should label the ticket card as sample data', () => {
      expect(
        getElement().querySelector('.sample-label')?.textContent,
      ).toContain('Sample data');
    });

    it('should show ticket number, position, wait and status', () => {
      const { ticketNumber, positionInQueue, estimatedWaitMinutes } =
        component.entry();

      expect(getText()).toContain(ticketNumber);
      expect(
        getElement().querySelector('.position-value')?.textContent,
      ).toContain(String(positionInQueue));
      expect(
        getElement().querySelector('.wait-value')?.textContent,
      ).toContain(String(estimatedWaitMinutes));
      expect(
        getElement().querySelector('.entry-status')?.textContent,
      ).toContain('Waiting');
    });

    it('should compute people ahead from the position', () => {
      component.entry.update((entry) => ({ ...entry, positionInQueue: 1 }));
      expect(component.peopleAhead()).toBe(0);

      component.entry.update((entry) => ({ ...entry, positionInQueue: 4 }));
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
        [QueueStatus.IN_SERVICE, 'In consultation'],
        [QueueStatus.SERVED, 'Completed'],
        [QueueStatus.CANCELLED, 'Cancelled'],
        [QueueStatus.NO_SHOW, 'No-show'],
      ];

      for (const [status, label] of expected) {
        component.entry.update((entry) => ({ ...entry, status }));
        expect(component.statusLabel()).toBe(label);
      }
    });

    it('should mark every step done once the ticket is completed', () => {
      component.entry.update((entry) => ({
        ...entry,
        status: QueueStatus.SERVED,
      }));
      fixture.detectChanges();

      const element = getElement();
      expect(element.querySelectorAll('.tracker-step.done').length).toBe(4);
      expect(element.querySelectorAll('.tracker-step.current').length).toBe(0);
    });

    it('should hide the tracker for cancelled and no-show tickets', () => {
      for (const status of [QueueStatus.CANCELLED, QueueStatus.NO_SHOW]) {
        component.entry.update((entry) => ({ ...entry, status }));
        fixture.detectChanges();

        const element = getElement();
        expect(element.querySelector('.tracker')).toBeNull();
        expect(element.querySelector('.terminal-note')).toBeTruthy();
      }
    });
  });

  describe('queue summary', () => {
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
        patientName: 'Jane Secret',
        roomNumber: 'Counter 2',
        calledAt: '2026-11-04T02:44:00.000Z',
      });

      flushStatus({
        currently_serving: {
          ticket_number: 'A-012',
          called_at: '2026-11-04T02:44:00.000Z',
          room_number: 'Counter 2',
        },
      });
      expect(getElement().querySelector('.now-serving')?.textContent).toContain(
        'A-012',
      );
    });

    it('should never display patientName from an event', () => {
      sse.called.next({
        queueId: QUEUE_ID,
        queueEntryId: 3,
        ticketNumber: 'A-012',
        patientName: 'Jane Secret',
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

      tick(POLL_INTERVAL_MS);
      flushStatus();

      tick(POLL_INTERVAL_MS);
      flushStatus();

      fixture.destroy();
      discardPeriodicTasks();
    }));

    it('should not poll while SSE is connected', fakeAsync(() => {
      sse.connected.next(true);
      fixture.detectChanges();
      flushStatus();

      tick(POLL_INTERVAL_MS * 3);
      http.expectNone(statusUrl);
    }));

    it('should stop polling once SSE reconnects', fakeAsync(() => {
      fixture.detectChanges();
      flushStatus();

      tick(POLL_INTERVAL_MS);
      flushStatus();

      sse.connected.next(true);
      tick(POLL_INTERVAL_MS * 3);
      http.expectNone(statusUrl);
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
});

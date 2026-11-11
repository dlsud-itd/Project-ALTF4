import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { QueueStatus } from '@core/models';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from './staff-dashboard.component';

describe('StaffDashboardComponent', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    const queueServiceMock = jasmine.createSpyObj('QueueService', [
      'getQueueStatus',
      'callNext',
      'updateEntryStatus',
    ]);

    queueServiceMock.getQueueStatus.and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: {
          queue_entry_id: 42,
          ticket_number: 'A-105',
          status: QueueStatus.CALLED,
          called_at: '2026-11-06T00:00:00.000Z',
          grace_expires_at: '2026-11-06T00:03:00.000Z',
          room_number: 'Counter 1',
        },
        total_waiting: 1,
        waiting_tickets: [],
        total_completed_today: 0,
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: '2026-11-06T00:00:00.000Z',
      }),
    );

    queueServiceMock.callNext.and.returnValue(
      of({
        queue_entry_id: 42,
        ticket_number: 'A-105',
        patient_name: 'Walk-in Patient',
        status: QueueStatus.CALLED,
        called_at: '2026-11-06T00:00:00.000Z',
        grace_expires_at: '2026-11-06T00:03:00.000Z',
        room_number: 'Counter 1',
      }),
    );
    queueServiceMock.updateEntryStatus.and.returnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [StaffDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: QueueService, useValue: queueServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the upcoming appointments panel without a profile card', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.profile-card')).toBeNull();
    expect(
      element.querySelector('.appointments-panel #appointments-title')
        ?.textContent,
    ).toContain('Upcoming appointments');
    expect(element.querySelector('.sample-data-tag')?.textContent).toContain(
      'Sample data',
    );
  });

  it('lists sample appointments with 12-hour times and status tags', () => {
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('.appointment-list li');

    expect(rows.length).toBe(component.appointments().length);
    expect(rows[0].textContent).toContain('Sample Patient A');
    expect(rows[0].querySelector('.appointment-time')?.textContent).toContain(
      '8:00 AM to 8:30 AM',
    );
    expect(rows[2].querySelector('.appointment-time')?.textContent).toContain(
      '1:00 PM to 1:30 PM',
    );
    expect(rows[0].querySelector('p-tag')).toBeTruthy();
  });

  it('shows a loading skeleton for the appointments panel', () => {
    component.isAppointmentsLoading.set(true);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '.appointments-panel',
    );

    expect(panel?.querySelector('app-loading-skeleton')).toBeTruthy();
    expect(panel?.querySelector('.appointment-list')).toBeNull();
  });

  it('shows an empty state when there are no upcoming appointments', () => {
    component.appointments.set([]);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '.appointments-panel',
    );

    expect(panel?.textContent).toContain('No upcoming appointments');
    expect(panel?.querySelector('.appointment-list')).toBeNull();
  });

  it('shows an appointments error state and clears it on retry', () => {
    component.hasAppointmentsError.set(true);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '.appointments-panel',
    );

    expect(panel?.querySelector('app-error-state')).toBeTruthy();

    component.onRetryAppointments();
    fixture.detectChanges();

    expect(component.hasAppointmentsError()).toBeFalse();
    expect(panel?.querySelector('app-error-state')).toBeNull();
  });

  it('shows the no active queue states when the queue is not active', () => {
    component.isStatsLoading.set(false);
    component.isQueueActive.set(false);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('.live-queue-panel')?.textContent,
    ).toContain('No active queue today');
    expect(element.textContent).toContain('No stats yet');
    expect(element.querySelector('.stats-grid')).toBeNull();
    expect(element.querySelector('.walk-in-layout')).toBeNull();
  });

  it('marks the queue inactive when the status says is_active is false', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getQueueStatus as jasmine.Spy).and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: false,
        currently_serving: null,
        total_waiting: 0,
        waiting_tickets: [],
        total_completed_today: 0,
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: '2026-11-06T00:00:00.000Z',
      }),
    );

    component.onRetryStats();

    expect(component.isQueueActive()).toBeFalse();
    expect(component.hasStatsError()).toBeFalse();
  });

  it('treats a 404 with code QUEUE_NOT_FOUND as no queue, not an error', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getQueueStatus as jasmine.Spy).and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { code: 'QUEUE_NOT_FOUND', message: 'not found' },
          }),
      ),
    );

    component.onRetryStats();

    expect(component.isQueueActive()).toBeFalse();
    expect(component.hasStatsError()).toBeFalse();
    expect(component.isStatsLoading()).toBeFalse();
  });

  it('keeps the error state for any other status error', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getQueueStatus as jasmine.Spy).and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { code: 'ENTRY_NOT_FOUND', message: 'other' },
          }),
      ),
    );

    component.onRetryStats();

    expect(component.hasStatsError()).toBeTrue();
    expect(component.isQueueActive()).toBeTrue();
  });

  it('should show queue management information without the staff token lookup card', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.tracking-panel')).toBeNull();
    expect(element.querySelector('.live-queue-layout .live-queue-panel')).toBeTruthy();
    expect(element.querySelector('.stats-grid')).toBeTruthy();
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('.ticket-card')).toBeNull();
  });

  it('should show a loading skeleton while the queue stats load', () => {
    component.isStatsLoading.set(true);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-loading-skeleton')).toBeTruthy();
    expect(element.querySelector('.stats-grid')).toBeNull();
  });

  it('should show an error state and retry when the stats fail to load', () => {
    component.hasStatsError.set(true);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('app-error-state').length).toBe(1);

    component.onRetryStats();
    fixture.detectChanges();

    expect(component.hasStatsError()).toBeFalse();
  });

  it('should call next patient and mark the active patient arrived or done', () => {
    component.onCallNext();
    expect(component.servingTicket()).toBe('A-105');
    expect(component.waitingCount()).toBeGreaterThanOrEqual(0);

    component.onPatientArrived();
    expect(TestBed.inject(QueueService).updateEntryStatus).toHaveBeenCalledWith(
      1,
      42,
      { status: QueueStatus.IN_SERVICE },
    );
    component.currentTicket.update((ticket) =>
      ticket ? { ...ticket, status: QueueStatus.IN_SERVICE } : ticket,
    );
    component.onComplete();
    expect(TestBed.inject(QueueService).updateEntryStatus).toHaveBeenCalledWith(
      1,
      42,
      { status: QueueStatus.DONE },
    );
  });

  it('renders the countdown and marks the last 30 seconds urgent', () => {
    component.currentTicket.update((ticket) =>
      ticket
        ? {
            ...ticket,
            status: QueueStatus.CALLED,
            grace_expires_at: new Date(Date.now() + 20_000).toISOString(),
          }
        : ticket,
    );
    component.countdownSeconds.set(19);

    fixture.detectChanges();

    expect(component.countdownText()).toBe('00:19');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.grace-countdown--urgent',
      ),
    ).toBeTruthy();
  });
});

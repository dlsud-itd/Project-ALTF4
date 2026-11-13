import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { QueueStatus, ServingTicket } from '@core/models';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from '../staff-dashboard.component';
import { setupStaffDashboard } from './staff-dashboard.spec-setup';

describe('StaffDashboardComponent presentation', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    ({ component, fixture } = await setupStaffDashboard());
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
    expect(element.querySelector('.sample-data-tag')).toBeNull();
    expect(
      TestBed.inject(QueueService).getStaffQueueStatus,
    ).toHaveBeenCalledWith(1);
  });

  it('renders actual patient names and visit reasons in the active and waiting tickets', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.now-calling')?.textContent).toContain(
      'Ada Lovelace',
    );
    expect(element.querySelector('.now-calling')?.textContent).toContain(
      'Headache',
    );
    const waitingTicket = element.querySelector('.waiting-list li');
    expect(waitingTicket?.textContent).toContain('Grace Hopper');
    expect(waitingTicket?.textContent).toContain('Annual checkup');
  });

  it('disables queue actions when a current patient or waiting ticket is unavailable', () => {
    const element = fixture.nativeElement as HTMLElement;
    const callNext = element.querySelector<HTMLButtonElement>(
      '.button-row button[aria-label="Call next patient"]',
    );
    const recall = element.querySelector<HTMLButtonElement>(
      '.button-row button[aria-label="Recall current patient"]',
    );
    const complete = element.querySelector<HTMLButtonElement>(
      '.button-row button[aria-label="Complete consultation"]',
    );

    expect(callNext?.disabled).toBeTrue();
    expect(recall?.disabled).toBeTrue();
    expect(complete?.disabled).toBeFalse();

    component.dashboard.currentTicket.set(null);
    fixture.detectChanges();

    expect(callNext?.disabled).toBeFalse();
    expect(recall?.disabled).toBeTrue();
    expect(complete?.disabled).toBeTrue();

    component.dashboard.waitingCount.set(0);
    fixture.detectChanges();
    expect(callNext?.disabled).toBeTrue();
  });

  it('shows fallback labels when patient details are missing', () => {
    component.dashboard.currentTicket.update((ticket: ServingTicket | null) =>
      ticket ? { ...ticket, patient_name: null, reason_for_visit: null } : null,
    );
    component.dashboard.waitingTickets.set([
      {
        queue_entry_id: 44,
        ticket_number: 'A-107',
        status: QueueStatus.WAITING,
      },
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.now-calling')?.textContent).toContain(
      'Unnamed patient',
    );
    expect(element.querySelector('.now-calling')?.textContent).toContain(
      'No reason provided',
    );
    expect(element.querySelector('.waiting-list li')?.textContent).toContain(
      'Unnamed patient',
    );
    expect(element.querySelector('.waiting-list li')?.textContent).toContain(
      'No reason provided',
    );
  });

  it('lists online appointments with 12-hour times and status tags', () => {
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('.appointment-list li');

    expect(rows.length).toBe(2);
    expect(rows.length).toBe(component.dashboard.appointments().length);
    expect(rows[0].textContent).toContain('John Albert Masangkay');
    expect(rows[0].querySelector('.appointment-time')?.textContent).toContain(
      '8:00 AM to 8:30 AM',
    );
    expect(rows[1].querySelector('.appointment-time')?.textContent).toContain(
      '9:30 AM to 10:00 AM',
    );
    expect(rows[0].querySelector('p-tag')).toBeTruthy();
    expect(element.textContent).not.toContain('Patient Three');
    expect(element.textContent).not.toContain('Past Cancelled Patient');
  });

  it('shows a loading skeleton for the appointments panel', () => {
    component.dashboard.isAppointmentsLoading.set(true);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '.appointments-panel',
    );

    expect(panel?.querySelector('app-loading-skeleton')).toBeTruthy();
    expect(panel?.querySelector('.appointment-list')).toBeNull();
  });

  it('shows an empty state when there are no upcoming appointments', () => {
    component.dashboard.appointments.set([]);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '.appointments-panel',
    );

    expect(panel?.textContent).toContain('No upcoming appointments');
    expect(panel?.querySelector('.appointment-list')).toBeNull();
  });

  it('shows an appointments error state and clears it on retry', () => {
    component.dashboard.hasAppointmentsError.set(true);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '.appointments-panel',
    );

    expect(panel?.querySelector('app-error-state')).toBeTruthy();

    component.dashboard.onRetryAppointments();
    fixture.detectChanges();

    expect(component.dashboard.hasAppointmentsError()).toBeFalse();
    expect(panel?.querySelector('app-error-state')).toBeNull();
  });

  it('shows the no active queue states when the queue is not active', () => {
    component.dashboard.isStatsLoading.set(false);
    component.dashboard.isQueueActive.set(false);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.live-queue-panel')?.textContent).toContain(
      'No active queue today',
    );
    expect(element.textContent).toContain('No stats yet');
    expect(element.querySelector('.stats-grid')).toBeNull();
    expect(element.querySelector('.walk-in-layout')).toBeNull();
  });

  it('marks the queue inactive when the status says is_active is false', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getStaffQueueStatus as jasmine.Spy).and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: false,
        currently_serving: null,
        total_waiting: 0,
        waiting_tickets: [],
        total_completed_today: 0,
        total_no_shows_today: 0,
        grace_period_ms: 180_000,
        newly_no_show_ticket_numbers: [],
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: '2026-11-06T00:00:00.000Z',
      }),
    );

    component.dashboard.onRetryStats();

    expect(component.dashboard.isQueueActive()).toBeFalse();
    expect(component.dashboard.hasStatsError()).toBeFalse();
  });

  it('treats a 404 with code QUEUE_NOT_FOUND as no queue, not an error', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getStaffQueueStatus as jasmine.Spy).and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { code: 'QUEUE_NOT_FOUND', message: 'not found' },
          }),
      ),
    );

    component.dashboard.onRetryStats();

    expect(component.dashboard.isQueueActive()).toBeFalse();
    expect(component.dashboard.hasStatsError()).toBeFalse();
    expect(component.dashboard.isStatsLoading()).toBeFalse();
  });

  it('keeps the error state for any other status error', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getStaffQueueStatus as jasmine.Spy).and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { code: 'ENTRY_NOT_FOUND', message: 'other' },
          }),
      ),
    );

    component.dashboard.onRetryStats();

    expect(component.dashboard.hasStatsError()).toBeTrue();
    expect(component.dashboard.isQueueActive()).toBeTrue();
  });

  it('should show queue management information without the staff token lookup card', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.tracking-panel')).toBeNull();
    expect(
      element.querySelector('.live-queue-layout .live-queue-panel'),
    ).toBeTruthy();
    expect(element.querySelector('.stats-grid')).toBeTruthy();
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('.ticket-card')).toBeNull();
  });

  it('should show a loading skeleton while the queue stats load', () => {
    component.dashboard.isStatsLoading.set(true);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-loading-skeleton')).toBeTruthy();
    expect(element.querySelector('.stats-grid')).toBeNull();
  });

  it('should show an error state and retry when the stats fail to load', () => {
    component.dashboard.hasStatsError.set(true);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('app-error-state').length).toBe(1);

    component.dashboard.onRetryStats();
    fixture.detectChanges();

    expect(component.dashboard.hasStatsError()).toBeFalse();
  });

  it('shows the empty calling state when no ticket is in service', () => {
    component.dashboard.currentTicket.set(null);
    fixture.detectChanges();

    const emptyState = (fixture.nativeElement as HTMLElement).querySelector(
      '.now-calling--empty',
    );
    expect(emptyState?.textContent).toContain('No patient is being called');
    expect(emptyState?.textContent).toContain(
      'Click Call Next Patient to start.',
    );
    expect(emptyState?.textContent).not.toContain(
      'No patient being called. Click Call Next Patient.',
    );
    expect(emptyState?.querySelector('.empty-calling-icon')).toBeTruthy();
    expect(emptyState?.querySelector('p-button')).toBeTruthy();
  });
});

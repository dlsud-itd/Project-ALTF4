import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { QueueStatus } from '@core/models';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from '../staff-dashboard.component';
import { setupStaffDashboard } from './staff-dashboard.spec-setup';
import {
  conflictError,
  spyOnQueueUpdate,
} from './staff-dashboard.actions.spec-helpers';

describe('StaffDashboardComponent queue lifecycle actions', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    ({ component, fixture } = await setupStaffDashboard());
  });

  it('shows no-show and cancel controls only for an active called ticket', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Mark as No-show',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Cancel ticket',
    );

    component.dashboard.currentTicket.update((ticket) =>
      ticket ? { ...ticket, status: QueueStatus.CALLED } : null,
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Mark as No-show',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Cancel',
    );
  });

  it('closes the no-show dialog on success, clears notes, and shows a notice', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getStaffQueueStatus as jasmine.Spy).and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: null,
        total_waiting: 1,
        waiting_tickets: [],
        total_completed_today: 0,
        total_no_shows_today: 1,
        grace_period_ms: 180_000,
        newly_no_show_ticket_numbers: [],
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }),
    );
    component.dashboard.currentTicket.update((ticket) =>
      ticket ? { ...ticket, status: QueueStatus.CALLED } : null,
    );
    component.dashboard.completeNotes.setValue('previous notes');
    component.dashboard.onMarkNoShow();
    expect(component.dashboard.isStatusDialogOpen()).toBeTrue();
    expect(spyOnQueueUpdate()).not.toHaveBeenCalled();

    component.dashboard.onConfirmStatusAction();

    expect(spyOnQueueUpdate()).toHaveBeenCalledWith(1, 42, {
      status: QueueStatus.NO_SHOW,
    });
    expect(component.dashboard.isStatusDialogOpen()).toBeFalse();
    expect(component.dashboard.completeNotes.value).toBe('');
    expect(component.dashboard.notice()?.message).toBe(
      'A-105 was marked as no-show.',
    );
    expect(component.dashboard.noShowCount()).toBe(1);
  });

  it('closes the cancel dialog on success and shows a notice', () => {
    component.dashboard.currentTicket.update((ticket) =>
      ticket ? { ...ticket, status: QueueStatus.IN_CONSULTATION } : null,
    );
    component.dashboard.onCancelEntry();
    expect(component.dashboard.isStatusDialogOpen()).toBeTrue();
    component.dashboard.onConfirmStatusAction();

    expect(spyOnQueueUpdate()).toHaveBeenCalledWith(1, 42, {
      status: QueueStatus.CANCELLED,
    });
    expect(component.dashboard.isStatusDialogOpen()).toBeFalse();
    expect(component.dashboard.notice()?.message).toBe('A-105 was cancelled.');
  });

  it('keeps the no-show dialog open with a friendly error on failure', () => {
    spyOnQueueUpdate().and.returnValue(
      throwError(() =>
        conflictError('INVALID_TRANSITION', 'The status has changed.'),
      ),
    );
    component.dashboard.currentTicket.update((ticket) =>
      ticket ? { ...ticket, status: QueueStatus.CALLED } : null,
    );
    component.dashboard.onMarkNoShow();
    component.dashboard.onConfirmStatusAction();
    fixture.detectChanges();

    expect(component.dashboard.isStatusDialogOpen()).toBeTrue();
    expect(component.dashboard.statusDialogError()).toBe(
      "This ticket's status has changed. Refresh the queue and try again.",
    );
  });

  it('keeps the cancel dialog open with an error when the request fails', () => {
    spyOnQueueUpdate().and.returnValue(
      throwError(() =>
        conflictError('INVALID_TRANSITION', 'The status has changed.'),
      ),
    );
    component.dashboard.onCancelEntry();
    component.dashboard.onConfirmStatusAction();

    expect(component.dashboard.isStatusDialogOpen()).toBeTrue();
    expect(component.dashboard.statusDialogError()).toBe(
      "This ticket's status has changed. Refresh the queue and try again.",
    );
  });

  it('starts consultation when the patient arrives before the deadline', () => {
    component.dashboard.currentTicket.update((ticket) =>
      ticket
        ? {
            ...ticket,
            status: QueueStatus.CALLED,
            called_at: new Date().toISOString(),
          }
        : null,
    );

    component.dashboard.onPatientArrived();

    expect(spyOnQueueUpdate()).toHaveBeenCalledWith(1, 42, {
      status: QueueStatus.IN_CONSULTATION,
    });
    expect(component.dashboard.currentTicket()?.status).toBe(
      QueueStatus.IN_CONSULTATION,
    );
  });

  it('marks a called patient as no-show when the timestamp-based timer expires', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getStaffQueueStatus as jasmine.Spy).and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: null,
        total_waiting: 0,
        waiting_tickets: [],
        total_completed_today: 0,
        total_no_shows_today: 1,
        grace_period_ms: 180_000,
        newly_no_show_ticket_numbers: [],
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }),
    );
    component.dashboard.currentTicket.update((ticket) =>
      ticket
        ? {
            ...ticket,
            status: QueueStatus.CALLED,
            called_at: new Date(Date.now() - 181_000).toISOString(),
          }
        : null,
    );

    component.dashboard.refreshGracePeriod();

    expect(spyOnQueueUpdate()).toHaveBeenCalledWith(1, 42, {
      status: QueueStatus.NO_SHOW,
    });
    expect(component.dashboard.currentTicket()).toBeNull();
    expect(component.dashboard.notice()?.message).toBe(
      'A-105 was marked as no-show.',
    );
  });

  it('does not duplicate a no-show notice or count when another tab already updated it', () => {
    spyOnQueueUpdate().and.returnValue(
      throwError(() =>
        conflictError('INVALID_TRANSITION', 'Ticket already updated.'),
      ),
    );
    component.dashboard.currentTicket.update((ticket) =>
      ticket
        ? {
            ...ticket,
            status: QueueStatus.CALLED,
            called_at: new Date(Date.now() - 181_000).toISOString(),
          }
        : null,
    );

    component.dashboard.refreshGracePeriod();

    expect(component.dashboard.noShowCount()).toBe(0);
    expect(component.dashboard.notice()).toBeNull();
    expect(component.dashboard.hasStatsError()).toBeFalse();
  });

  it('marks an expired persisted call as no-show when the queue refreshes', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getStaffQueueStatus as jasmine.Spy).and.returnValues(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: {
          queue_entry_id: 42,
          ticket_number: 'A-105',
          status: QueueStatus.CALLED,
          patient_name: 'Ada Lovelace',
          reason_for_visit: 'Headache',
          called_at: new Date(Date.now() - 181_000).toISOString(),
          grace_expires_at: new Date(Date.now() - 1_000).toISOString(),
          room_number: 'Counter 1',
          provider: 'Dr. Ana Santos',
        },
        total_waiting: 1,
        waiting_tickets: [],
        total_completed_today: 0,
        total_no_shows_today: 1,
        grace_period_ms: 180_000,
        newly_no_show_ticket_numbers: ['A-105'],
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }),
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: null,
        total_waiting: 0,
        waiting_tickets: [],
        total_completed_today: 0,
        total_no_shows_today: 1,
        grace_period_ms: 180_000,
        newly_no_show_ticket_numbers: [],
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }),
    );

    component.dashboard.onRetryStats();

    expect(spyOnQueueUpdate()).toHaveBeenCalledWith(1, 42, {
      status: QueueStatus.NO_SHOW,
    });
    expect(component.dashboard.currentTicket()).toBeNull();
    expect(component.dashboard.notice()?.message).toBe(
      'A-105 was marked as no-show.',
    );
  });
});

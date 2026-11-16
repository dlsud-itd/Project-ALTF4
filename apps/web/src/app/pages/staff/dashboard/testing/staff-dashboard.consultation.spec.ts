import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { QueueStatus } from '@core/models';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from '../staff-dashboard.component';
import { setupStaffDashboard } from './staff-dashboard.spec-setup';
import {
  conflictError,
  queryDashboardDocument,
  spyOnQueueUpdate,
} from './staff-dashboard.actions.spec-helpers';

describe('StaffDashboardComponent consultation actions', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    ({ component, fixture } = await setupStaffDashboard());
  });

  it('opens the complete dialog as the confirmation', () => {
    component.dashboard.onComplete();
    fixture.detectChanges();

    expect(component.dashboard.isCompleteDialogOpen()).toBeTrue();
    expect(queryDashboardDocument('.dialog-lead')?.textContent).toContain(
      'Mark ticket A-105 as completed? Notes are optional.',
    );
    expect(spyOnQueueUpdate()).not.toHaveBeenCalled();
  });

  it('passes the trimmed notes when completing', () => {
    component.dashboard.onComplete();
    component.dashboard.completeNotes.setValue('  Follow-up in 2 weeks  ');

    component.dashboard.onConfirmComplete();

    expect(spyOnQueueUpdate()).toHaveBeenCalledWith(1, 42, {
      status: QueueStatus.COMPLETED,
      notes: 'Follow-up in 2 weeks',
    });
    expect(component.dashboard.isCompleteDialogOpen()).toBeFalse();
    expect(component.dashboard.currentTicket()?.status).not.toBe(
      QueueStatus.COMPLETED,
    );
  });

  it('completes without notes when the field is empty', () => {
    component.dashboard.onComplete();

    component.dashboard.onConfirmComplete();

    expect(spyOnQueueUpdate()).toHaveBeenCalledWith(1, 42, {
      status: QueueStatus.COMPLETED,
    });
  });

  it('clears the current ticket and refreshes the completed count after completion', () => {
    const queueService = TestBed.inject(QueueService);
    (queueService.getStaffQueueStatus as jasmine.Spy).and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: null,
        total_waiting: 1,
        waiting_tickets: [
          {
            queue_entry_id: 43,
            ticket_number: 'A-106',
            status: QueueStatus.WAITING,
            patient_name: 'Grace Hopper',
            reason_for_visit: 'Annual checkup',
          },
        ],
        total_completed_today: 1,
        total_no_shows_today: 0,
        grace_period_ms: 180_000,
        newly_no_show_ticket_numbers: [],
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }),
    );
    component.dashboard.onComplete();

    component.dashboard.onConfirmComplete();

    expect(component.dashboard.currentTicket()).toBeNull();
    expect(component.dashboard.completedCount()).toBe(1);
  });

  it('does not complete when the notes are over 500 characters', () => {
    component.dashboard.onComplete();
    component.dashboard.completeNotes.setValue('a'.repeat(501));

    component.dashboard.onConfirmComplete();

    expect(spyOnQueueUpdate()).not.toHaveBeenCalled();
    expect(component.dashboard.isCompleteDialogOpen()).toBeTrue();
  });

  it('closes the complete dialog on cancel without a request', () => {
    component.dashboard.onComplete();
    component.dashboard.onCancelComplete();

    expect(component.dashboard.isCompleteDialogOpen()).toBeFalse();
    expect(spyOnQueueUpdate()).not.toHaveBeenCalled();
  });

  it('shows a 409 complete error inside the dialog and keeps stats', () => {
    spyOnQueueUpdate().and.returnValue(
      throwError(() =>
        conflictError(
          'INVALID_TRANSITION',
          'Only an in-service patient can be marked done.',
        ),
      ),
    );
    component.dashboard.onComplete();

    component.dashboard.onConfirmComplete();
    fixture.detectChanges();

    expect(component.dashboard.isCompleteDialogOpen()).toBeTrue();
    expect(
      queryDashboardDocument('.dialog-form [role="alert"]')?.textContent,
    ).toContain(
      "This ticket's status has changed. Refresh the queue and try again.",
    );
    expect(component.dashboard.hasStatsError()).toBeFalse();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.stats-grid'),
    ).toBeTruthy();
  });
});

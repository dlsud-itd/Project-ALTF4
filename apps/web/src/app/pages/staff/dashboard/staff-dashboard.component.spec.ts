import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { QueueStatus, ServingTicket } from '@core/models';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from './staff-dashboard.component';

describe('StaffDashboardComponent', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    const queueServiceMock = jasmine.createSpyObj('QueueService', [
      'getStaffQueueStatus',
      'callNext',
      'recallCurrent',
      'updateEntryStatus',
    ]);

    queueServiceMock.getStaffQueueStatus.and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: {
          queue_entry_id: 42,
          ticket_number: 'A-105',
          status: QueueStatus.IN_SERVICE,
          patient_name: 'Ada Lovelace',
          reason_for_visit: 'Headache',
          called_at: new Date().toISOString(),
          grace_expires_at: null,
          room_number: 'Counter 1',
        },
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
        total_completed_today: 0,
        total_no_shows_today: 0,
        grace_period_ms: 180_000,
        newly_no_show_ticket_numbers: [],
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
        reason_for_visit: 'Cough',
        status: QueueStatus.CALLED,
        called_at: new Date().toISOString(),
        grace_expires_at: new Date(Date.now() + 180_000).toISOString(),
        grace_period_ms: 180_000,
        room_number: 'Counter 1',
      }),
    );
    queueServiceMock.recallCurrent.and.returnValue(of(undefined));
    queueServiceMock.updateEntryStatus.and.returnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [StaffDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
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

    component.currentTicket.set(null);
    fixture.detectChanges();

    expect(callNext?.disabled).toBeFalse();
    expect(recall?.disabled).toBeTrue();
    expect(complete?.disabled).toBeTrue();

    component.waitingCount.set(0);
    fixture.detectChanges();
    expect(callNext?.disabled).toBeTrue();
  });

  it('shows fallback labels when patient details are missing', () => {
    component.currentTicket.update((ticket: ServingTicket | null) =>
      ticket ? { ...ticket, patient_name: null, reason_for_visit: null } : null,
    );
    component.waitingTickets.set([
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

    component.onRetryStats();

    expect(component.isQueueActive()).toBeFalse();
    expect(component.hasStatsError()).toBeFalse();
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

    component.onRetryStats();

    expect(component.isQueueActive()).toBeFalse();
    expect(component.hasStatsError()).toBeFalse();
    expect(component.isStatsLoading()).toBeFalse();
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

    component.onRetryStats();

    expect(component.hasStatsError()).toBeTrue();
    expect(component.isQueueActive()).toBeTrue();
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

  describe('queue controls', () => {
    const queryDocument = (selector: string): HTMLElement | null =>
      document.body.querySelector<HTMLElement>(selector);

    const conflictError = (code: string, message: string): HttpErrorResponse =>
      new HttpErrorResponse({ status: 409, error: { code, message } });

    const spyOnUpdate = (): jasmine.Spy =>
      TestBed.inject(QueueService).updateEntryStatus as jasmine.Spy;

    const spyOnCallNext = (): jasmine.Spy =>
      TestBed.inject(QueueService).callNext as jasmine.Spy;

    const spyOnRecall = (): jasmine.Spy =>
      TestBed.inject(QueueService).recallCurrent as jasmine.Spy;

    it('opens the call next dialog with the room and staff prefilled', () => {
      component.currentTicket.set(null);
      component.onCallNext();
      fixture.detectChanges();

      expect(component.isCallNextDialogOpen()).toBeTrue();
      expect(component.callNextForm.getRawValue()).toEqual({
        roomNumber: 'Counter 1',
        practitionerName: 'Staff Nurse',
      });
      expect(queryDocument('#call-room')?.hasAttribute('autofocus')).toBeTrue();
      expect(spyOnCallNext()).not.toHaveBeenCalled();
    });

    it('does not call next when a field is blank', () => {
      component.currentTicket.set(null);
      component.onCallNext();
      component.callNextForm.patchValue({ roomNumber: '   ' });

      component.onConfirmCallNext();

      expect(spyOnCallNext()).not.toHaveBeenCalled();
      expect(component.callNextForm.controls.roomNumber.touched).toBeTrue();
      expect(component.isCallNextDialogOpen()).toBeTrue();
    });

    it('calls next with the entered room and practitioner', () => {
      component.currentTicket.set(null);
      component.onCallNext();
      component.callNextForm.setValue({
        roomNumber: ' Room 2 ',
        practitionerName: ' Dr. Test ',
      });

      component.onConfirmCallNext();

      expect(spyOnCallNext()).toHaveBeenCalledWith(1, {
        roomNumber: 'Room 2',
        practitionerId: 'Dr. Test',
      });
      expect(component.currentTicket()?.ticket_number).toBe('A-105');
      expect(component.isCallNextDialogOpen()).toBeFalse();
    });

    it('closes the call next dialog on cancel without a request', () => {
      component.currentTicket.set(null);
      component.onCallNext();
      component.onCancelCallNext();

      expect(component.isCallNextDialogOpen()).toBeFalse();
      expect(spyOnCallNext()).not.toHaveBeenCalled();
    });

    it('shows a 409 call next error inside the open dialog', () => {
      spyOnCallNext().and.returnValue(
        throwError(() =>
          conflictError('QUEUE_CALL_IN_PROGRESS', 'A patient is being called.'),
        ),
      );
      component.currentTicket.set(null);
      component.onCallNext();

      component.onConfirmCallNext();
      fixture.detectChanges();

      const alert = queryDocument('.dialog-form [role="alert"]');
      expect(component.isCallNextDialogOpen()).toBeTrue();
      expect(alert?.textContent).toContain(
        'Something went wrong. Please try again.',
      );
      expect(component.hasStatsError()).toBeFalse();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.stats-grid'),
      ).toBeTruthy();
    });

    it('does not expose technical details from a call next error', () => {
      spyOnCallNext().and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                message: [
                  'roomNumber should not be empty',
                  'practitionerId is bad',
                ],
              },
            }),
        ),
      );
      component.currentTicket.set(null);
      component.onCallNext();

      component.onConfirmCallNext();
      fixture.detectChanges();

      expect(component.callNextError()).toBe(
        'Something went wrong. Please try again.',
      );
      expect(component.isCallNextDialogOpen()).toBeTrue();
      expect(component.hasStatsError()).toBeFalse();
    });

    it('shows the grace-period state and arrival action for a called patient', () => {
      component.currentTicket.update((ticket) =>
        ticket
          ? {
              ...ticket,
              status: QueueStatus.CALLED,
              called_at: new Date().toISOString(),
            }
          : null,
      );
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      expect(
        element.querySelector('.current-status--called')?.textContent,
      ).toContain('Called - waiting for patient');
      expect(
        element.querySelector('.grace-countdown')?.textContent?.trim(),
      ).toMatch(/^\d{2}:\d{2}$/);
      expect(element.textContent).toContain(
        'Patient Arrived / Start Consultation',
      );
    });

    it('recalls only the current called ticket', () => {
      const calledAt = new Date().toISOString();
      component.currentTicket.update((ticket) =>
        ticket
          ? { ...ticket, status: QueueStatus.CALLED, called_at: calledAt }
          : null,
      );

      component.onRecallCurrent();

      expect(spyOnRecall()).toHaveBeenCalledWith(1);
      expect(spyOnUpdate()).not.toHaveBeenCalled();
      expect(component.currentTicket()?.called_at).toBe(calledAt);
    });

    it('shows an error when recall fails without clearing the current ticket', () => {
      component.currentTicket.update((ticket) =>
        ticket ? { ...ticket, status: QueueStatus.CALLED } : null,
      );
      spyOnRecall().and.returnValue(
        throwError(() =>
          conflictError('RECALL_FAILED', 'Could not recall the patient.'),
        ),
      );

      component.onRecallCurrent();
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(
        element.querySelector('app-notice [role="alert"]')?.textContent,
      ).toContain('Something went wrong. Please try again.');
      expect(component.currentTicket()?.ticket_number).toBe('A-105');
    });

    it('opens the complete dialog as the confirmation', () => {
      component.onComplete();
      fixture.detectChanges();

      expect(component.isCompleteDialogOpen()).toBeTrue();
      expect(queryDocument('.dialog-lead')?.textContent).toContain(
        'Mark ticket A-105 as completed? Notes are optional.',
      );
      expect(spyOnUpdate()).not.toHaveBeenCalled();
    });

    it('passes the trimmed notes when completing', () => {
      component.onComplete();
      component.completeNotes.setValue('  Follow-up in 2 weeks  ');

      component.onConfirmComplete();

      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.DONE,
        notes: 'Follow-up in 2 weeks',
      });
      expect(component.isCompleteDialogOpen()).toBeFalse();
      expect(component.currentTicket()?.status).not.toBe(QueueStatus.DONE);
    });

    it('completes without notes when the field is empty', () => {
      component.onComplete();

      component.onConfirmComplete();

      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.DONE,
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
      component.onComplete();

      component.onConfirmComplete();

      expect(component.currentTicket()).toBeNull();
      expect(component.completedCount()).toBe(1);
    });

    it('does not complete when the notes are over 500 characters', () => {
      component.onComplete();
      component.completeNotes.setValue('a'.repeat(501));

      component.onConfirmComplete();

      expect(spyOnUpdate()).not.toHaveBeenCalled();
      expect(component.isCompleteDialogOpen()).toBeTrue();
    });

    it('closes the complete dialog on cancel without a request', () => {
      component.onComplete();
      component.onCancelComplete();

      expect(component.isCompleteDialogOpen()).toBeFalse();
      expect(spyOnUpdate()).not.toHaveBeenCalled();
    });

    it('shows a 409 complete error inside the dialog and keeps stats', () => {
      spyOnUpdate().and.returnValue(
        throwError(() =>
          conflictError(
            'INVALID_QUEUE_TRANSITION',
            'Only an in-service patient can be marked done.',
          ),
        ),
      );
      component.onComplete();

      component.onConfirmComplete();
      fixture.detectChanges();

      expect(component.isCompleteDialogOpen()).toBeTrue();
      expect(
        queryDocument('.dialog-form [role="alert"]')?.textContent,
      ).toContain('Something went wrong. Please try again.');
      expect(component.hasStatsError()).toBeFalse();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.stats-grid'),
      ).toBeTruthy();
    });

    it('shows no-show controls only for a called ticket', () => {
      component.currentTicket.set(null);
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent;

      expect(component.isNoShowCancelEnabled).toBeFalse();
      expect(text).not.toContain('Mark no-show');
    });

    it('asks for confirmation before no-show and cancel when enabled', () => {
      Object.assign(component, { isNoShowCancelEnabled: true });
      component.currentTicket.update((ticket) =>
        ticket ? { ...ticket, status: QueueStatus.CALLED } : null,
      );
      fixture.detectChanges();
      const confirmation =
        fixture.debugElement.injector.get(ConfirmationService);
      const confirmSpy = spyOn(confirmation, 'confirm');

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Mark as No-show',
      );

      component.onMarkNoShow();
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(spyOnUpdate()).not.toHaveBeenCalled();

      confirmSpy.calls.mostRecent().args[0].accept?.();
      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.NO_SHOW,
      });

      component.onCancelEntry();
      confirmSpy.calls.mostRecent().args[0].accept?.();
      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.CANCELLED,
      });
    });

    it('starts consultation when the patient arrives before the deadline', () => {
      component.currentTicket.update((ticket) =>
        ticket
          ? {
              ...ticket,
              status: QueueStatus.CALLED,
              called_at: new Date().toISOString(),
            }
          : null,
      );

      component.onPatientArrived();

      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.IN_SERVICE,
      });
      expect(component.currentTicket()?.status).toBe(QueueStatus.IN_SERVICE);
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
      component.currentTicket.update((ticket) =>
        ticket
          ? {
              ...ticket,
              status: QueueStatus.CALLED,
              called_at: new Date(Date.now() - 181_000).toISOString(),
            }
          : null,
      );

      component.refreshGracePeriod();

      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.NO_SHOW,
      });
      expect(component.currentTicket()).toBeNull();
      expect(component.notice()?.message).toBe('A-105 was marked as no-show.');
    });

    it('does not duplicate a no-show notice or count when another tab already updated it', () => {
      spyOnUpdate().and.returnValue(
        throwError(() =>
          conflictError('INVALID_QUEUE_TRANSITION', 'Ticket already updated.'),
        ),
      );
      component.currentTicket.update((ticket) =>
        ticket
          ? {
              ...ticket,
              status: QueueStatus.CALLED,
              called_at: new Date(Date.now() - 181_000).toISOString(),
            }
          : null,
      );

      component.refreshGracePeriod();

      expect(component.noShowCount()).toBe(0);
      expect(component.notice()).toBeNull();
      expect(component.hasStatsError()).toBeFalse();
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

      component.onRetryStats();

      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.NO_SHOW,
      });
      expect(component.currentTicket()).toBeNull();
      expect(component.notice()?.message).toBe('A-105 was marked as no-show.');
    });
  });

  it('shows the empty calling state when no ticket is in service', () => {
    component.currentTicket.set(null);
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

  it('auto-dismisses a notice after five seconds', fakeAsync(() => {
    component.onRecallCurrent();

    expect(component.notice()?.message).toBe(
      'Recall is only available while waiting for the patient.',
    );
    tick(4999);
    expect(component.notice()).not.toBeNull();
    tick(1);
    expect(component.notice()).toBeNull();
  }));

  it('replaces a notice and restarts its dismissal timer', fakeAsync(() => {
    component.onRecallCurrent();
    tick(4000);

    component.onCallNext();

    expect(component.notice()?.message).toBe(
      'A patient is already being called.',
    );
    tick(4000);
    expect(component.notice()).not.toBeNull();
    tick(1000);
    expect(component.notice()).toBeNull();
  }));

  it('clears an old notice when Call Next Patient is selected', () => {
    component.currentTicket.set(null);
    component.onRecallCurrent();

    component.onCallNext();

    expect(component.notice()).toBeNull();
    expect(component.isCallNextDialogOpen()).toBeTrue();
  });

  it('allows the notice to be dismissed manually', () => {
    component.onRecallCurrent();
    fixture.detectChanges();

    const closeButton = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('.notice-close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Dismiss notice');

    closeButton?.click();

    expect(component.notice()).toBeNull();
  });

  it('clears the notice dismiss timer when the component is destroyed', fakeAsync(() => {
    component.onRecallCurrent();
    const noticeBeforeDestroy = component.notice();

    fixture.destroy();
    tick(5000);

    expect(component.notice()).toBe(noticeBeforeDestroy);
  }));

  it('guards queue actions when no ticket is active', () => {
    const queueService = TestBed.inject(QueueService);
    component.currentTicket.set(null);
    component.waitingCount.set(0);

    component.onRecallCurrent();
    component.onComplete();
    component.onConfirmComplete();
    component.onCallNext();

    expect(queueService.recallCurrent).not.toHaveBeenCalled();
    expect(queueService.updateEntryStatus).not.toHaveBeenCalled();
    expect(queueService.callNext).not.toHaveBeenCalled();
    expect(component.notice()?.message).toBe('The queue is empty.');
  });
});

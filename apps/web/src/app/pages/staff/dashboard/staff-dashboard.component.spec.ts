import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
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

  describe('queue controls', () => {
    const queryDocument = (selector: string): HTMLElement | null =>
      document.body.querySelector<HTMLElement>(selector);

    const conflictError = (code: string, message: string): HttpErrorResponse =>
      new HttpErrorResponse({ status: 409, error: { code, message } });

    const spyOnUpdate = (): jasmine.Spy =>
      TestBed.inject(QueueService).updateEntryStatus as jasmine.Spy;

    const spyOnCallNext = (): jasmine.Spy =>
      TestBed.inject(QueueService).callNext as jasmine.Spy;

    it('opens the call next dialog with the room and staff prefilled', () => {
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
      component.onCallNext();
      component.callNextForm.patchValue({ roomNumber: '   ' });

      component.onConfirmCallNext();

      expect(spyOnCallNext()).not.toHaveBeenCalled();
      expect(component.callNextForm.controls.roomNumber.touched).toBeTrue();
      expect(component.isCallNextDialogOpen()).toBeTrue();
    });

    it('calls next with the entered room and practitioner', () => {
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
      expect(component.servingTicket()).toBe('A-105');
      expect(component.isCallNextDialogOpen()).toBeFalse();
    });

    it('closes the call next dialog on cancel without a request', () => {
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
      component.onCallNext();

      component.onConfirmCallNext();
      fixture.detectChanges();

      const alert = queryDocument('.dialog-form [role="alert"]');
      expect(component.isCallNextDialogOpen()).toBeTrue();
      expect(alert?.textContent).toContain('A patient is being called.');
      expect(component.hasStatsError()).toBeFalse();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.stats-grid'),
      ).toBeTruthy();
    });

    it('joins array messages from a 400 call next error', () => {
      spyOnCallNext().and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                message: ['roomNumber should not be empty', 'practitionerId is bad'],
              },
            }),
        ),
      );
      component.onCallNext();

      component.onConfirmCallNext();
      fixture.detectChanges();

      expect(component.callNextError()).toBe(
        'roomNumber should not be empty practitionerId is bad',
      );
      expect(component.isCallNextDialogOpen()).toBeTrue();
      expect(component.hasStatsError()).toBeFalse();
    });

    it('renames the arrival button to Start consultation', () => {
      const element = fixture.nativeElement as HTMLElement;

      expect(element.textContent).toContain('Start consultation');
      expect(element.textContent).not.toContain('Patient arrived');

      component.onPatientArrived();
      expect(spyOnUpdate()).toHaveBeenCalledWith(1, 42, {
        status: QueueStatus.IN_SERVICE,
      });
    });

    it('shows a start error in the page alert and keeps the stats', () => {
      spyOnUpdate().and.returnValue(
        throwError(() =>
          conflictError('INVALID_QUEUE_TRANSITION', 'The grace period expired.'),
        ),
      );

      component.onPatientArrived();
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.action-error[role="alert"]')?.textContent)
        .toContain('The grace period expired.');
      expect(component.hasStatsError()).toBeFalse();
      expect(element.querySelector('.stats-grid')).toBeTruthy();

      spyOnUpdate().and.returnValue(of({}));
      component.onPatientArrived();
      fixture.detectChanges();

      expect(component.actionError()).toBeNull();
      expect(element.querySelector('.action-error')).toBeNull();
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
      expect(queryDocument('.dialog-form [role="alert"]')?.textContent)
        .toContain('Only an in-service patient can be marked done.');
      expect(component.hasStatsError()).toBeFalse();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.stats-grid'),
      ).toBeTruthy();
    });

    it('hides no-show and cancel while the flag is off', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent;

      expect(component.isNoShowCancelEnabled).toBeFalse();
      expect(text).not.toContain('Mark no-show');
    });

    it('asks for confirmation before no-show and cancel when enabled', () => {
      Object.assign(component, { isNoShowCancelEnabled: true });
      fixture.detectChanges();
      const confirmation = fixture.debugElement.injector.get(
        ConfirmationService,
      );
      const confirmSpy = spyOn(confirmation, 'confirm');

      expect(
        (fixture.nativeElement as HTMLElement).textContent,
      ).toContain('Mark no-show');

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

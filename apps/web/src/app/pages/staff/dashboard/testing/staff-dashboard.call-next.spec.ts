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
  spyOnCallNext,
  spyOnQueueUpdate,
  spyOnRecall,
} from './staff-dashboard.actions.spec-helpers';

describe('StaffDashboardComponent call and recall actions', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    ({ component, fixture } = await setupStaffDashboard());
  });

  it('opens the call next dialog with the room and staff prefilled', () => {
    component.dashboard.currentTicket.set(null);
    component.dashboard.onCallNext();
    fixture.detectChanges();

    expect(component.dashboard.isCallNextDialogOpen()).toBeTrue();
    expect(component.dashboard.callNextForm.getRawValue()).toEqual({
      room: 'Counter 1',
      provider: 'Staff Nurse',
    });
    expect(
      queryDashboardDocument('#call-room')?.hasAttribute('autofocus'),
    ).toBeTrue();
    expect(spyOnCallNext()).not.toHaveBeenCalled();
  });

  it('does not call next when a field is blank', () => {
    component.dashboard.currentTicket.set(null);
    component.dashboard.onCallNext();
    component.dashboard.callNextForm.patchValue({ room: '   ' });

    component.dashboard.onConfirmCallNext();

    expect(spyOnCallNext()).not.toHaveBeenCalled();
    expect(component.dashboard.callNextForm.controls.room.touched).toBeTrue();
    expect(component.dashboard.isCallNextDialogOpen()).toBeTrue();
  });

  it('calls next with the entered room and practitioner', () => {
    component.dashboard.currentTicket.set(null);
    component.dashboard.onCallNext();
    component.dashboard.callNextForm.setValue({
      room: ' Room 2 ',
      provider: ' Dr. Test ',
    });

    component.dashboard.onConfirmCallNext();

    expect(spyOnCallNext()).toHaveBeenCalledWith(1, {
      room: 'Room 2',
      provider: 'Dr. Test',
    });
    expect(component.dashboard.currentTicket()?.ticket_number).toBe('A-105');
    expect(component.dashboard.isCallNextDialogOpen()).toBeFalse();
  });

  it('closes the call next dialog on cancel without a request', () => {
    component.dashboard.currentTicket.set(null);
    component.dashboard.onCallNext();
    component.dashboard.onCancelCallNext();

    expect(component.dashboard.isCallNextDialogOpen()).toBeFalse();
    expect(spyOnCallNext()).not.toHaveBeenCalled();
  });

  it('shows a 409 call next error inside the open dialog', () => {
    spyOnCallNext().and.returnValue(
      throwError(() =>
        conflictError('STATION_BUSY', 'A patient is being called.'),
      ),
    );
    component.dashboard.currentTicket.set(null);
    component.dashboard.onCallNext();

    component.dashboard.onConfirmCallNext();
    fixture.detectChanges();

    const alert = queryDashboardDocument('.dialog-form [role="alert"]');
    expect(component.dashboard.isCallNextDialogOpen()).toBeTrue();
    expect(alert?.textContent).toContain(
      'A patient is already called or in consultation.',
    );
    expect(component.dashboard.hasStatsError()).toBeFalse();
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
              message: ['room should not be empty', 'provider is bad'],
            },
          }),
      ),
    );
    component.dashboard.currentTicket.set(null);
    component.dashboard.onCallNext();

    component.dashboard.onConfirmCallNext();
    fixture.detectChanges();

    expect(component.dashboard.callNextError()).toBe(
      'Something went wrong. Please try again.',
    );
    expect(component.dashboard.isCallNextDialogOpen()).toBeTrue();
    expect(component.dashboard.hasStatsError()).toBeFalse();
  });

  it('shows the grace-period state and arrival action for a called patient', () => {
    component.dashboard.currentTicket.update((ticket) =>
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
    expect(element.textContent).toContain('Counter 1 · Dr. Ana Santos');
  });

  it('shows friendly call-next messages for an empty queue and a lost race', () => {
    component.dashboard.currentTicket.set(null);
    spyOnCallNext().and.returnValue(
      throwError(() =>
        conflictError('QUEUE_EMPTY', 'No patients are waiting.'),
      ),
    );
    component.dashboard.onCallNext();
    component.dashboard.onConfirmCallNext();
    expect(component.dashboard.callNextError()).toBe(
      'No patients are waiting.',
    );

    spyOnCallNext().and.returnValue(
      throwError(() =>
        conflictError('ALREADY_CALLED', 'Another staff member called it.'),
      ),
    );
    component.dashboard.currentTicket.set(null);
    component.dashboard.onCallNext();
    component.dashboard.onConfirmCallNext();
    expect(component.dashboard.callNextError()).toBe(
      'Another staff member already called the next patient.',
    );
  });

  it('recalls only the current called ticket', () => {
    const calledAt = new Date().toISOString();
    component.dashboard.currentTicket.update((ticket) =>
      ticket
        ? { ...ticket, status: QueueStatus.CALLED, called_at: calledAt }
        : null,
    );

    component.dashboard.onRecallCurrent();

    expect(spyOnRecall()).toHaveBeenCalledWith(1);
    expect(spyOnQueueUpdate()).not.toHaveBeenCalled();
    expect(component.dashboard.currentTicket()?.called_at).toBe(calledAt);
  });

  it('shows an error when recall fails without clearing the current ticket', () => {
    component.dashboard.currentTicket.update((ticket) =>
      ticket ? { ...ticket, status: QueueStatus.CALLED } : null,
    );
    spyOnRecall().and.returnValue(
      throwError(() =>
        conflictError('RECALL_FAILED', 'Could not recall the patient.'),
      ),
    );

    component.dashboard.onRecallCurrent();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(
      element.querySelector('app-notice [role="alert"]')?.textContent,
    ).toContain('Something went wrong. Please try again.');
    expect(component.dashboard.currentTicket()?.ticket_number).toBe('A-105');
  });
});

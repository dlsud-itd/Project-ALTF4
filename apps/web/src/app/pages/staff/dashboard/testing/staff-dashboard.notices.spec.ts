import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from '../staff-dashboard.component';
import { setupStaffDashboard } from './staff-dashboard.spec-setup';

describe('StaffDashboardComponent notices and guards', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    ({ component, fixture } = await setupStaffDashboard());
  });

  it('auto-dismisses a notice after five seconds', fakeAsync(() => {
    component.dashboard.onRecallCurrent();

    expect(component.dashboard.notice()?.message).toBe(
      'Recall is only available while waiting for the patient.',
    );
    tick(4999);
    expect(component.dashboard.notice()).not.toBeNull();
    tick(1);
    expect(component.dashboard.notice()).toBeNull();
  }));

  it('replaces a notice and restarts its dismissal timer', fakeAsync(() => {
    component.dashboard.onRecallCurrent();
    tick(4000);

    component.dashboard.onCallNext();

    expect(component.dashboard.notice()?.message).toBe(
      'A patient is already being called.',
    );
    tick(4000);
    expect(component.dashboard.notice()).not.toBeNull();
    tick(1000);
    expect(component.dashboard.notice()).toBeNull();
  }));

  it('clears an old notice when Call Next Patient is selected', () => {
    component.dashboard.currentTicket.set(null);
    component.dashboard.onRecallCurrent();

    component.dashboard.onCallNext();

    expect(component.dashboard.notice()).toBeNull();
    expect(component.dashboard.isCallNextDialogOpen()).toBeTrue();
  });

  it('allows the notice to be dismissed manually', () => {
    component.dashboard.onRecallCurrent();
    fixture.detectChanges();

    const closeButton = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLButtonElement>('.notice-close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Dismiss notice');

    closeButton?.click();

    expect(component.dashboard.notice()).toBeNull();
  });

  it('clears the notice dismiss timer when the component is destroyed', fakeAsync(() => {
    component.dashboard.onRecallCurrent();
    const noticeBeforeDestroy = component.dashboard.notice();

    fixture.destroy();
    tick(5000);

    expect(component.dashboard.notice()).toBe(noticeBeforeDestroy);
  }));

  it('guards queue actions when no ticket is active', () => {
    const queueService = TestBed.inject(QueueService);
    component.dashboard.currentTicket.set(null);
    component.dashboard.waitingCount.set(0);

    component.dashboard.onRecallCurrent();
    component.dashboard.onComplete();
    component.dashboard.onConfirmComplete();
    component.dashboard.onCallNext();

    expect(queueService.recallCurrent).not.toHaveBeenCalled();
    expect(queueService.updateEntryStatus).not.toHaveBeenCalled();
    expect(queueService.callNext).not.toHaveBeenCalled();
    expect(component.dashboard.notice()?.message).toBe('The queue is empty.');
  });
});

import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PatientNotificationsComponent } from './notifications.component';

const LOAD_WAIT_MS = 1000;
const SAMPLE_TOTAL = 5;
const SAMPLE_UNREAD = 3;

describe('PatientNotificationsComponent', () => {
  let fixture: ComponentFixture<PatientNotificationsComponent>;
  let component: PatientNotificationsComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientNotificationsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientNotificationsComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement as HTMLElement;
  });

  function render(): void {
    fixture.detectChanges();
    tick(LOAD_WAIT_MS);
    fixture.detectChanges();
  }

  it('shows the loading skeleton first', () => {
    fixture.detectChanges();
    expect(element.querySelector('app-loading-skeleton')).toBeTruthy();
    component.ngOnDestroy();
  });

  it('renders sample items with the Sample data label', fakeAsync(() => {
    render();
    expect(element.querySelectorAll('.notification-item').length).toBe(
      SAMPLE_TOTAL,
    );
    expect(element.querySelector('.sample-label')?.textContent).toContain(
      'Sample data',
    );
    expect(component.unreadCount()).toBe(SAMPLE_UNREAD);
    expect(element.querySelectorAll('.notification-item.unread').length).toBe(
      SAMPLE_UNREAD,
    );
  }));

  it('marks one item as read locally', fakeAsync(() => {
    render();
    component.markAsRead(5);
    fixture.detectChanges();
    expect(component.unreadCount()).toBe(SAMPLE_UNREAD - 1);
  }));

  it('marks all items as read', fakeAsync(() => {
    render();
    component.markAllAsRead();
    fixture.detectChanges();
    expect(component.unreadCount()).toBe(0);
    expect(element.querySelectorAll('.notification-item.unread').length).toBe(
      0,
    );
  }));

  it('links queue calls and reminders to their pages', () => {
    expect(component.routeFor('QUEUE_CALL')).toBe('/patient/queue');
    expect(component.routeFor('APPOINTMENT_REMINDER')).toBe(
      '/patient/bookings',
    );
    expect(component.routeFor('GENERAL')).toBeNull();
  });

  it('shows the empty state when there are no notifications', fakeAsync(() => {
    render();
    component.notifications.set([]);
    fixture.detectChanges();
    expect(element.querySelector('app-empty-state')).toBeTruthy();
  }));

  it('shows the error state and retries', fakeAsync(() => {
    render();
    component.loadState.set('error');
    fixture.detectChanges();
    expect(element.querySelector('app-error-state')).toBeTruthy();
    component.load();
    tick(LOAD_WAIT_MS);
    fixture.detectChanges();
    expect(component.loadState()).toBe('ready');
  }));
});

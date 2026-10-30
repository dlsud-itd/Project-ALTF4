import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PatientDashboardComponent } from './patient-dashboard.component';

describe('PatientDashboardComponent', () => {
  let component: PatientDashboardComponent;
  let fixture: ComponentFixture<PatientDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientDashboardComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the welcome banner and dashboard cards', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.welcome-banner')).toBeTruthy();
    expect(element.querySelectorAll('.dashboard-card').length).toBe(3);
  });

  it('should show a loading skeleton while the queue status loads', () => {
    component.isQueueLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-loading-skeleton')).toBeTruthy();
  });

  it('should show an error state and allow retrying', () => {
    component.hasQueueError.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-error-state')).toBeTruthy();

    component.onRetryQueue();
    fixture.detectChanges();

    expect(component.hasQueueError()).toBeFalse();
  });

  it('should allow joining and leaving the queue', () => {
    expect(component.currentTicket()).toBeNull();

    component.onJoinQueue();
    expect(component.currentTicket()).toBe('A-108');

    component.onLeaveQueue();
    expect(component.currentTicket()).toBeNull();
  });
});


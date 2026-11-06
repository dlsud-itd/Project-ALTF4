import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { QueueStatus } from '@core/models';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from './staff-dashboard.component';

describe('StaffDashboardComponent', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    const queueServiceMock = jasmine.createSpyObj('QueueService', [
      'getQueueStatus',
      'generateStaffQueueNumber',
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
    queueServiceMock.generateStaffQueueNumber.and.returnValue(
      of({
        queue_entry_id: 43,
        queue_id: 1,
        ticket_number: 'A-106',
        position_in_queue: 2,
        estimated_wait_minutes: 30,
        status: QueueStatus.WAITING,
        tracking_token: 'trk_0123456789abcdef',
        joined_at: '2026-11-06T00:00:00.000Z',
      }),
    );
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

  it('should fall back to placeholder profile details when unauthenticated', () => {
    expect(component.staffName()).toBe('Staff Nurse');
    expect(component.staffEmail()).toBe('staff@dlsud.edu.ph');
    expect(component.staffRole()).toBe('STAFF');
  });

  it('should render the profile summary and upcoming events placeholder', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.profile-card')).toBeTruthy();
    expect(element.querySelector('#profile-title')?.textContent).toContain('Staff Nurse');
    expect(element.querySelector('.placeholder-panel #events-title')?.textContent).toContain('Upcoming Events');
  });

  it('should show queue management information without the staff token lookup card', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.tracking-panel')).toBeNull();
    expect(element.querySelector('.walk-in-layout .live-queue-panel')).toBeTruthy();
    expect(element.querySelector('.stats-grid')).toBeTruthy();
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

  it('creates a walk-in ticket using the name and optional reason only', () => {
    component.walkInForm.setValue({
      name: '  Jane   Doe ',
      reasonForVisit: '  Headache  ',
    });

    component.onGenerateQueueNumber();

    expect(
      TestBed.inject(QueueService).generateStaffQueueNumber,
    ).toHaveBeenCalledWith(1, {
      name: 'Jane Doe',
      reasonForVisit: 'Headache',
    }    );
    expect(component.generatedTicket()).toBe('A-106');
  });
});

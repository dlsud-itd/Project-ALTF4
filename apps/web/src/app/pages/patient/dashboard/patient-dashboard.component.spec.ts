import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AppointmentsService, QueueService, SseService } from '@core/services';
import { PatientDashboardComponent } from './patient-dashboard.component';
import { PatientAppointment } from '@core/models';

describe('PatientDashboardComponent', () => {
  let component: PatientDashboardComponent;
  let fixture: ComponentFixture<PatientDashboardComponent>;
  let appointmentsService: jasmine.SpyObj<AppointmentsService>;
  let confirmationService: ConfirmationService;

  const mockAppointments: PatientAppointment[] = [
    {
      id: 1,
      status: 'BOOKED',
      createdAt: '2026-10-31T00:00:00.000Z',
      slot: {
        id: 10,
        clinicDate: '2026-11-12',
        startTime: '10:00',
        endTime: '10:30',
        capacity: 2,
        remainingCapacity: 1,
        isBookable: true,
      },
    },
  ];

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('AppointmentsService', [
      'getMyAppointments',
      'cancelAppointment',
    ]);
    spy.getMyAppointments.and.returnValue(of({ appointments: [] }));

    const queueServiceMock = jasmine.createSpyObj('QueueService', [
      'getQueueStatus',
      'getMyQueueEntry',
      'joinOnline',
    ]);
    queueServiceMock.joinOnline.and.returnValue(
      of({
        queue_entry_id: 10,
        queue_id: 1,
        ticket_number: 'A-010',
        position_in_queue: 1,
        estimated_wait_minutes: 15,
        status: 'WAITING',
        joined_at: '2026-11-06T00:00:00.000Z',
      }),
    );
    queueServiceMock.getQueueStatus.and.returnValue(
      of({
        queue_id: 1,
        clinic_date: '2026-11-06',
        is_active: true,
        currently_serving: {
          queue_entry_id: 1,
          ticket_number: 'A-001',
          status: 'CALLED',
          called_at: '2026-11-06T00:00:00.000Z',
          grace_expires_at: '2026-11-06T00:03:00.000Z',
          room_number: 'Counter 1',
        },
        total_waiting: 0,
        waiting_tickets: [],
        total_completed_today: 0,
        avg_wait_time_minutes: 0,
        server_time: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      }),
    );
    queueServiceMock.getMyQueueEntry.and.returnValue(of(null));

    const sseServiceMock = {
      queueUpdated$: of(),
      queueCalled$: of(),
      subscribeToQueue: jasmine.createSpy('subscribeToQueue'),
      disconnect: jasmine.createSpy('disconnect'),
    };

    await TestBed.configureTestingModule({
      imports: [PatientDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AppointmentsService, useValue: spy },
        { provide: QueueService, useValue: queueServiceMock },
        { provide: SseService, useValue: sseServiceMock },
        ConfirmationService,
      ],
    }).compileComponents();

    appointmentsService = TestBed.inject(AppointmentsService) as jasmine.SpyObj<AppointmentsService>;
    confirmationService = TestBed.inject(ConfirmationService);
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

  it('should show an empty state when patient has no appointments', () => {
    component.appointments.set([]);
    component.isAppointmentsLoading.set(false);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should show a loading skeleton while appointments load', () => {
    component.isAppointmentsLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.appointments-section app-loading-skeleton')).toBeTruthy();
  });

  it('should show an error state and allow retrying when appointment fetch fails', () => {
    component.isAppointmentsLoading.set(false);
    component.appointmentsError.set('Network connection failed');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.appointments-section app-error-state')).toBeTruthy();

    appointmentsService.getMyAppointments.and.returnValue(of({ appointments: mockAppointments }));
    component.loadAppointments();
    expect(component.appointmentsError()).toBeNull();
  });

  it('should render upcoming appointments when present', () => {
    component.appointments.set(mockAppointments);
    component.isAppointmentsLoading.set(false);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.appointment-card').length).toBe(1);
    expect(element.textContent).toContain('10:00 - 10:30');
    expect(element.textContent).toContain('Confirmed');
  });

  it('should prompt confirmation when cancelling an appointment', () => {
    const confirmSpy = spyOn((component as any).confirmationService, 'confirm');
    component.onCancelAppointment(mockAppointments[0]);

    expect(confirmSpy).toHaveBeenCalled();
  });

  it('should allow joining the queue online directly from the dashboard card when appointment is booked', () => {
    const queueService = TestBed.inject(QueueService);
    component.appointments.set(mockAppointments);
    component.onJoinQueue();

    expect(queueService.joinOnline).toHaveBeenCalled();
    expect(component.currentTicket()).toBe('A-010');
    expect(component.estimatedWaitMinutes()).toBe(15);
  });
});

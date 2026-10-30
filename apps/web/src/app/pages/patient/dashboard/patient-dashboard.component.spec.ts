import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AppointmentsService } from '@core/services';
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

    await TestBed.configureTestingModule({
      imports: [PatientDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AppointmentsService, useValue: spy },
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
    spyOn(confirmationService, 'confirm');
    component.onCancelAppointment(mockAppointments[0]);

    expect(confirmationService.confirm).toHaveBeenCalled();
  });
});

import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS } from '@core/config/clinic.constants';
import { AppointmentsService } from '@core/services';
import { PatientBookingsHistoryComponent } from './patient-bookings-history.component';

describe('PatientBookingsHistoryComponent', () => {
  let component: PatientBookingsHistoryComponent;
  let fixture: ComponentFixture<PatientBookingsHistoryComponent>;
  let appointmentsServiceSpy: jasmine.SpyObj<AppointmentsService>;

  const todayStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  beforeEach(async () => {
    appointmentsServiceSpy = jasmine.createSpyObj('AppointmentsService', [
      'getMyAppointments',
      'cancelAppointment',
      'archiveAppointment',
    ]);
    appointmentsServiceSpy.archiveAppointment.and.returnValue(
      of({ message: 'Appointment archived successfully' }),
    );
    appointmentsServiceSpy.getMyAppointments.and.returnValue(
      of({
        activeBookingCount: 1,
        maxActiveBookings: 3,
        appointments: [
          {
            id: 1,
            patientId: 10,
            slotId: 20,
            status: 'BOOKED',
            createdAt: '2026-11-01T00:00:00.000Z',
            slot: {
              id: 20,
              clinicDate: todayStr(),
              startTime: '09:00',
              endTime: '10:00',
              capacity: 1,
              isBookable: true,
              isExpired: false,
              remainingCapacity: 0,
            },
            reservedQueueEntry: {
              ticketNumber: 'A-001',
              queueNumber: 1,
              positionInQueue: 1,
              estimatedWaitMinutes: 0,
            },
          },
          {
            id: 2,
            patientId: 10,
            slotId: 21,
            status: 'COMPLETED',
            createdAt: '2026-11-01T00:00:00.000Z',
            slot: {
              id: 21,
              clinicDate: '2026-11-01',
              startTime: '10:00',
              endTime: '11:00',
              capacity: 1,
              isBookable: true,
              isExpired: true,
              remainingCapacity: 0,
            },
          },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [PatientBookingsHistoryComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        ConfirmationService,
        { provide: AppointmentsService, useValue: appointmentsServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientBookingsHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load appointments on init', () => {
    expect(component.appointments().length).toBe(2);
    expect(component.upcomingAppointments().length).toBe(1);
    expect(component.pastAppointments().length).toBe(1);
  });

  it('refreshes appointment status while the history page is open', fakeAsync(() => {
    fixture.destroy();
    fixture = TestBed.createComponent(PatientBookingsHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const initialRequestCount =
      appointmentsServiceSpy.getMyAppointments.calls.count();

    tick(PATIENT_APPOINTMENTS_REFRESH_INTERVAL_MS);

    expect(appointmentsServiceSpy.getMyAppointments).toHaveBeenCalledTimes(
      initialRequestCount + 1,
    );
    fixture.destroy();
    discardPeriodicTasks();
  }));

  it('should filter appointments by active tab', () => {
    component.setFilter('UPCOMING');
    expect(component.filteredAppointments().length).toBe(1);
    expect(component.filteredAppointments()[0].status).toBe('BOOKED');

    component.setFilter('PAST');
    expect(component.filteredAppointments().length).toBe(1);
    expect(component.filteredAppointments()[0].status).toBe('COMPLETED');

    component.setFilter('ALL');
    expect(component.filteredAppointments().length).toBe(2);
  });

  it('allows archive only for past completed or cancelled appointments', () => {
    const completed = component.appointments()[1];
    const upcoming = component.appointments()[0];

    expect(component.canArchive(completed)).toBeTrue();
    expect(component.canArchive(upcoming)).toBeFalse();
  });
});

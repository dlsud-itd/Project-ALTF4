import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { AppointmentsService } from '@core/services';
import { StaffPastAppointmentsComponent } from './staff-past-appointments.component';

describe('StaffPastAppointmentsComponent', () => {
  let component: StaffPastAppointmentsComponent;
  let fixture: ComponentFixture<StaffPastAppointmentsComponent>;
  let appointmentsServiceSpy: jasmine.SpyObj<AppointmentsService>;

  beforeEach(async () => {
    appointmentsServiceSpy = jasmine.createSpyObj('AppointmentsService', [
      'getAppointments',
    ]);
    appointmentsServiceSpy.getAppointments.and.returnValue(
      of({
        appointments: [
          {
            id: 1,
            patientId: 10,
            slotId: 20,
            status: 'COMPLETED',
            createdAt: '2026-11-01T00:00:00.000Z',
            patient: { id: 10, fullName: 'Jane Doe', affiliation: 'STUDENT' },
            slot: {
              id: 20,
              clinicDate: '2026-11-01',
              startTime: '09:00',
              endTime: '10:00',
              capacity: 1,
              isBookable: true,
              remainingCapacity: 0,
            },
          },
          {
            id: 2,
            patientId: 11,
            slotId: 21,
            status: 'NO_SHOW',
            createdAt: '2026-11-02T00:00:00.000Z',
            patient: { id: 11, fullName: 'John Smith', affiliation: 'FACULTY' },
            slot: {
              id: 21,
              clinicDate: '2026-11-02',
              startTime: '10:00',
              endTime: '11:00',
              capacity: 1,
              isBookable: true,
              remainingCapacity: 0,
            },
          },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [StaffPastAppointmentsComponent],
      providers: [
        provideHttpClient(),
        { provide: AppointmentsService, useValue: appointmentsServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffPastAppointmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load past appointments on init', () => {
    expect(component.pastAppointments().length).toBe(2);
  });

  it('should filter by status', () => {
    component.setStatusFilter('COMPLETED');
    expect(component.filteredAppointments().length).toBe(1);
    expect(component.filteredAppointments()[0].status).toBe('COMPLETED');

    component.setStatusFilter('NO_SHOW');
    expect(component.filteredAppointments().length).toBe(1);
    expect(component.filteredAppointments()[0].status).toBe('NO_SHOW');

    component.setStatusFilter('ALL');
    expect(component.filteredAppointments().length).toBe(2);
  });

  it('should filter by search query', () => {
    component.searchQuery.set('Jane');
    expect(component.filteredAppointments().length).toBe(1);
    expect(component.filteredAppointments()[0].patient.fullName).toBe('Jane Doe');
  });
});

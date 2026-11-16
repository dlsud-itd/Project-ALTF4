import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { QueueStatus } from '@core/models';
import { AppointmentsService, QueueService } from '@core/services';
import { StaffDashboardComponent } from '../staff-dashboard.component';

export async function setupStaffDashboard(): Promise<{
  component: StaffDashboardComponent;
  fixture: ComponentFixture<StaffDashboardComponent>;
}> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 3);
  const clinicDate = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const queueServiceMock = jasmine.createSpyObj('QueueService', [
    'getStaffQueueStatus',
    'callNext',
    'recallCurrent',
    'updateEntryStatus',
  ]);
  const appointmentsServiceMock = jasmine.createSpyObj('AppointmentsService', [
    'getAppointments',
  ]);
  appointmentsServiceMock.getAppointments.and.returnValue(
    of({
      appointments: [
        {
          id: 1,
          status: 'BOOKED',
          createdAt: '2026-11-01T00:00:00.000Z',
          patient: {
            id: 101,
            fullName: 'John Albert Masangkay',
            affiliation: 'STUDENT',
          },
          slot: {
            id: 10,
            clinicDate: clinicDate(futureDate),
            startTime: '08:00',
            endTime: '08:30',
            capacity: 1,
            remainingCapacity: 1,
            isBookable: true,
          },
        },
        {
          id: 2,
          status: 'BOOKED',
          createdAt: '2026-11-01T00:00:00.000Z',
          patient: {
            id: 102,
            fullName: 'Patient Two',
            affiliation: 'FACULTY',
          },
          slot: {
            id: 11,
            clinicDate: clinicDate(futureDate),
            startTime: '09:30',
            endTime: '10:00',
            capacity: 1,
            remainingCapacity: 1,
            isBookable: true,
          },
        },
        {
          id: 3,
          status: 'COMPLETED',
          createdAt: '2026-11-01T00:00:00.000Z',
          patient: {
            id: 103,
            fullName: 'Patient Three',
            affiliation: 'STAFF',
          },
          slot: {
            id: 12,
            clinicDate: clinicDate(futureDate),
            startTime: '13:00',
            endTime: '13:30',
            capacity: 1,
            remainingCapacity: 0,
            isBookable: false,
          },
        },
        {
          id: 4,
          status: 'CANCELLED',
          createdAt: '2026-11-01T00:00:00.000Z',
          patient: {
            id: 104,
            fullName: 'Past Cancelled Patient',
            affiliation: 'STAFF',
          },
          slot: {
            id: 13,
            clinicDate: clinicDate(pastDate),
            startTime: '14:00',
            endTime: '14:30',
            capacity: 1,
            remainingCapacity: 1,
            isBookable: false,
          },
        },
      ],
    }),
  );

  queueServiceMock.getStaffQueueStatus.and.returnValue(
    of({
      queue_id: 1,
      clinic_date: '2026-11-06',
      is_active: true,
      currently_serving: {
        queue_entry_id: 42,
        ticket_number: 'A-105',
        status: QueueStatus.IN_CONSULTATION,
        patient_name: 'Ada Lovelace',
        reason_for_visit: 'Headache',
        called_at: new Date().toISOString(),
        grace_expires_at: null,
        room_number: 'Counter 1',
        provider: 'Dr. Ana Santos',
      },
      total_waiting: 1,
      waiting_tickets: [
        {
          queue_entry_id: 43,
          ticket_number: 'A-106',
          status: QueueStatus.WAITING,
          patient_name: 'Grace Hopper',
          reason_for_visit: 'Annual checkup',
        },
      ],
      total_completed_today: 0,
      total_no_shows_today: 0,
      grace_period_ms: 180_000,
      newly_no_show_ticket_numbers: [],
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
      reason_for_visit: 'Cough',
      status: QueueStatus.CALLED,
      called_at: new Date().toISOString(),
      grace_expires_at: new Date(Date.now() + 180_000).toISOString(),
      grace_period_ms: 180_000,
      room_number: 'Counter 1',
      provider: 'Staff Nurse',
    }),
  );
  queueServiceMock.recallCurrent.and.returnValue(of(undefined));
  queueServiceMock.updateEntryStatus.and.returnValue(of({}));

  await TestBed.configureTestingModule({
    imports: [StaffDashboardComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideNoopAnimations(),
      { provide: QueueService, useValue: queueServiceMock },
      { provide: AppointmentsService, useValue: appointmentsServiceMock },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(StaffDashboardComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { component, fixture };
}

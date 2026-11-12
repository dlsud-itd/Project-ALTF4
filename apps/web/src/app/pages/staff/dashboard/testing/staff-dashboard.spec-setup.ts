import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { QueueStatus } from '@core/models';
import { QueueService } from '@core/services';
import { StaffDashboardComponent } from '../staff-dashboard.component';

export async function setupStaffDashboard(): Promise<{
  component: StaffDashboardComponent;
  fixture: ComponentFixture<StaffDashboardComponent>;
}> {
  const queueServiceMock = jasmine.createSpyObj('QueueService', [
    'getStaffQueueStatus',
    'callNext',
    'recallCurrent',
    'updateEntryStatus',
  ]);

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
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(StaffDashboardComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { component, fixture };
}

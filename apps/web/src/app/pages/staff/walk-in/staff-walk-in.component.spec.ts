import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { QueueStatus } from '@core/models';
import { QueueService } from '@core/services';
import { StaffWalkInComponent } from './staff-walk-in.component';

describe('StaffWalkInComponent', () => {
  let component: StaffWalkInComponent;
  let fixture: ComponentFixture<StaffWalkInComponent>;
  let queueServiceMock: jasmine.SpyObj<QueueService>;

  beforeEach(async () => {
    queueServiceMock = jasmine.createSpyObj('QueueService', [
      'generateStaffQueueNumber',
    ]);
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
      imports: [StaffWalkInComponent],
      providers: [
        provideHttpClient(),
        { provide: QueueService, useValue: queueServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffWalkInComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and render the walk-in form', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(component).toBeTruthy();
    expect(element.querySelector('.page-top h2')?.textContent).toContain(
      'Walk-in',
    );
    expect(element.querySelector('#walk-in-name')).toBeTruthy();
    expect(element.querySelector('.ticket-card')).toBeNull();
  });

  it('creates a walk-in ticket using the name and optional reason only', () => {
    component.walkInForm.setValue({
      name: '  Jane   Doe ',
      reasonForVisit: '  Headache  ',
    });

    component.onGenerateQueueNumber();
    fixture.detectChanges();

    expect(queueServiceMock.generateStaffQueueNumber).toHaveBeenCalledWith(1, {
      name: 'Jane Doe',
      reasonForVisit: 'Headache',
    });
    expect(component.generatedTicket()).toBe('A-106');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.ticket-number')
        ?.textContent,
    ).toContain('A-106');
  });

  it('does not submit an invalid name', () => {
    component.walkInForm.setValue({ name: 'J', reasonForVisit: '' });

    component.onGenerateQueueNumber();

    expect(queueServiceMock.generateStaffQueueNumber).not.toHaveBeenCalled();
    expect(component.walkInForm.controls.name.touched).toBeTrue();
  });

  it('shows the backend error message when the ticket fails', () => {
    queueServiceMock.generateStaffQueueNumber.and.returnValue(
      throwError(() => ({ error: { message: 'Queue closed' } })),
    );
    component.walkInForm.setValue({ name: 'Jane Doe', reasonForVisit: '' });

    component.onGenerateQueueNumber();
    fixture.detectChanges();

    expect(component.walkInError()).toBe('Queue closed');
    expect(component.isGeneratingQueue()).toBeFalse();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')
        ?.textContent,
    ).toContain('Queue closed');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { QueueStatus } from '@core/models';
import { QueueService, AppConfirmService } from '@core/services';
import { StaffWalkInComponent } from './staff-walk-in.component';

describe('StaffWalkInComponent', () => {
  let component: StaffWalkInComponent;
  let fixture: ComponentFixture<StaffWalkInComponent>;
  let queueServiceMock: jasmine.SpyObj<QueueService>;
  let confirmServiceMock: jasmine.SpyObj<AppConfirmService>;

  beforeEach(async () => {
    queueServiceMock = jasmine.createSpyObj('QueueService', [
      'getTodayQueue',
      'generateStaffQueueNumber',
    ]);
    queueServiceMock.getTodayQueue.and.returnValue(
      of({
        id: 1,
        clinic_date: '2026-11-19',
        is_open: true,
        fallback_service_minutes: 15,
      }),
    );
    confirmServiceMock = jasmine.createSpyObj('AppConfirmService', [
      'confirmReview',
      'confirmDestructive',
      'confirmWarning',
    ]);
    confirmServiceMock.confirmReview.and.callFake((opts: any) => opts.accept());
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
        { provide: AppConfirmService, useValue: confirmServiceMock },
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
    expect(element.querySelector('.ticket-placeholder')?.textContent).toContain(
      'Ticket will appear here',
    );
    expect(element.querySelector('.ticket-card img')).toBeNull();
  });

  it('creates a walk-in ticket using the name, phone, and required reason', () => {
    component.walkInForm.setValue({
      name: '  Jane   Doe ',
      phoneNumber: '0917 123 4567',
      reasonForVisit: '  Headache  ',
    });

    component.onGenerateQueueNumber();
    fixture.detectChanges();

    expect(queueServiceMock.generateStaffQueueNumber).toHaveBeenCalledWith(1, {
      name: 'Jane Doe',
      phoneNumber: '+639171234567',
      reasonForVisit: 'Headache',
    });
    expect(component.issuedTicket()).toEqual({
      ticketNumber: 'A-106',
      patientName: 'Jane Doe',
      visitReason: 'Headache',
      issuedAt: '2026-11-06T00:00:00.000Z',
      status: QueueStatus.WAITING,
    });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.ticket-number')
        ?.textContent,
    ).toContain('A-106');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.ticket-patient')
        ?.textContent,
    ).toContain('Jane Doe');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.ticket-reason')
        ?.textContent,
    ).toContain('Headache');
  });

  it('rejects a missing reason and shows a required inline error', () => {
    component.walkInForm.setValue({
      name: 'Jane Doe',
      phoneNumber: '09171234567',
      reasonForVisit: '',
    });
    component.onGenerateQueueNumber();
    fixture.detectChanges();

    expect(queueServiceMock.generateStaffQueueNumber).not.toHaveBeenCalled();
    expect(component.walkInForm.controls.reasonForVisit.touched).toBeTrue();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.field-error')
        ?.textContent,
    ).toContain('required');
    expect(
      (
        (fixture.nativeElement as HTMLElement).querySelector(
          'p-button button',
        ) as HTMLButtonElement
      )?.disabled,
    ).toBeTrue();
  });

  it('does not submit an invalid name', () => {
    component.walkInForm.setValue({
      name: 'J',
      phoneNumber: '09171234567',
      reasonForVisit: '',
    });

    component.onGenerateQueueNumber();

    expect(queueServiceMock.generateStaffQueueNumber).not.toHaveBeenCalled();
    expect(component.walkInForm.controls.name.touched).toBeTrue();
  });

  it('shows the backend error message when the ticket fails', () => {
    queueServiceMock.generateStaffQueueNumber.and.returnValue(
      throwError(() => ({ error: { message: 'Queue closed' } })),
    );
    component.walkInForm.setValue({
      name: 'Jane Doe',
      phoneNumber: '09171234567',
      reasonForVisit: 'Routine checkup',
    });

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

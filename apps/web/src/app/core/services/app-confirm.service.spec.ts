import { TestBed } from '@angular/core/testing';
import { ConfirmationService } from 'primeng/api';
import { AppConfirmService } from './app-confirm.service';

describe('AppConfirmService', () => {
  let service: AppConfirmService;
  let confirmationServiceSpy: jasmine.SpyObj<ConfirmationService>;

  beforeEach(() => {
    confirmationServiceSpy = jasmine.createSpyObj('ConfirmationService', ['confirm']);

    TestBed.configureTestingModule({
      providers: [
        AppConfirmService,
        { provide: ConfirmationService, useValue: confirmationServiceSpy },
      ],
    });

    service = TestBed.inject(AppConfirmService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('calls confirmationService with danger severity for confirmDestructive', () => {
    const acceptFn = jasmine.createSpy('accept');
    service.confirmDestructive({
      header: 'Cancel Appointment',
      message: 'Are you sure?',
      accept: acceptFn,
    });

    expect(confirmationServiceSpy.confirm).toHaveBeenCalledWith(
      jasmine.objectContaining({
        header: 'Cancel Appointment',
        message: 'Are you sure?',
        acceptButtonProps: { severity: 'danger' },
        acceptLabel: 'Yes, Confirm',
      }),
    );
  });

  it('calls confirmationService with warn severity for confirmWarning', () => {
    const acceptFn = jasmine.createSpy('accept');
    service.confirmWarning({
      header: 'Mark No-Show',
      message: 'Mark as absent?',
      accept: acceptFn,
    });

    expect(confirmationServiceSpy.confirm).toHaveBeenCalledWith(
      jasmine.objectContaining({
        header: 'Mark No-Show',
        message: 'Mark as absent?',
        acceptButtonProps: { severity: 'warn' },
      }),
    );
  });

  it('calls confirmationService with primary severity for confirmReview', () => {
    const acceptFn = jasmine.createSpy('accept');
    service.confirmReview({
      header: 'Confirm Booking',
      message: 'Book consultation on 2026-11-20?',
      accept: acceptFn,
    });

    expect(confirmationServiceSpy.confirm).toHaveBeenCalledWith(
      jasmine.objectContaining({
        header: 'Confirm Booking',
        message: 'Book consultation on 2026-11-20?',
        acceptButtonProps: { severity: 'primary' },
        acceptLabel: 'Confirm & Submit',
      }),
    );
  });
});


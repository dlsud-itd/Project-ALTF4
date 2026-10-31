import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { BookingsComponent } from './bookings.component';
import { SlotsService, AppointmentsService } from '@core/services';
import { ClinicSlot, PatientAppointment } from '@core/models';

describe('BookingsComponent', () => {
  let component: BookingsComponent;
  let fixture: ComponentFixture<BookingsComponent>;
  let slotsServiceSpy: jasmine.SpyObj<SlotsService>;
  let appointmentsServiceSpy: jasmine.SpyObj<AppointmentsService>;

  const mockSlots: ClinicSlot[] = [
    {
      id: 1,
      clinicDate: '2026-11-12',
      startTime: '09:00',
      endTime: '09:30',
      capacity: 3,
      remainingCapacity: 2,
      isBookable: true,
    },
    {
      id: 2,
      clinicDate: '2026-11-12',
      startTime: '13:00',
      endTime: '13:30',
      capacity: 2,
      remainingCapacity: 1,
      isBookable: true,
    },
    {
      id: 3,
      clinicDate: '2026-11-12',
      startTime: '14:00',
      endTime: '14:30',
      capacity: 2,
      remainingCapacity: 0, // Full slot
      isBookable: true,
    },
    {
      id: 4,
      clinicDate: '2026-11-12',
      startTime: '15:00',
      endTime: '15:30',
      capacity: 2,
      remainingCapacity: 2,
      isBookable: false, // Closed slot
    },
  ];

  beforeEach(async () => {
    slotsServiceSpy = jasmine.createSpyObj('SlotsService', ['getSlots']);
    appointmentsServiceSpy = jasmine.createSpyObj('AppointmentsService', [
      'bookAppointment',
    ]);

    slotsServiceSpy.getSlots.and.returnValue(of({ slots: mockSlots }));

    await TestBed.configureTestingModule({
      imports: [BookingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
        { provide: SlotsService, useValue: slotsServiceSpy },
        { provide: AppointmentsService, useValue: appointmentsServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch and show available slots, hiding non-bookable and full slots from patients', () => {
    // Only slot 1 and slot 2 have remainingCapacity > 0 and isBookable === true
    expect(component.availableSlots().length).toBe(2);
    expect(component.availableSlots().map((s) => s.id)).toEqual([1, 2]);

    const slotCards = fixture.nativeElement.querySelectorAll('.slot-card');
    expect(slotCards.length).toBe(2);
  });

  it('should display the attending doctor profile header', () => {
    const doctorCard = fixture.nativeElement.querySelector('.doctor-banner-card');
    expect(doctorCard).toBeTruthy();
    expect(doctorCard.textContent).toContain(component.clinicDoctor);
  });

  it('should filter slots by morning and afternoon sessions', () => {
    component.onFilterSession('Morning');
    fixture.detectChanges();

    expect(component.filteredSlots().length).toBe(1);
    expect(component.filteredSlots()[0].id).toBe(1);

    component.onFilterSession('Afternoon');
    fixture.detectChanges();

    expect(component.filteredSlots().length).toBe(1);
    expect(component.filteredSlots()[0].id).toBe(2);
  });

  it('should select an available slot and display details in booking summary', () => {
    const slot = component.filteredSlots()[0];
    component.onSelectSlot(slot);
    fixture.detectChanges();

    expect(component.selectedSlotId()).toBe(slot.id);
    expect(component.selectedSlot()?.id).toBe(slot.id);

    const summaryCard = fixture.nativeElement.querySelector('.summary-card');
    expect(summaryCard.textContent).toContain(slot.timeRange);
  });

  it('should submit booking details and display success screen on successful response', () => {
    const slot = component.filteredSlots()[0];
    component.onSelectSlot(slot);
    component.reasonForVisit.set('Routine health checkup');

    const mockResponse = {
      message: 'Appointment booked successfully',
      appointment: {
        id: 99,
        status: 'BOOKED' as const,
        createdAt: '2026-10-31T00:00:00.000Z',
        slot: {
          id: slot.id,
          clinicDate: '2026-11-12',
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.totalCapacity,
          remainingCapacity: 1,
          isBookable: true,
        },
      },
    };

    appointmentsServiceSpy.bookAppointment.and.returnValue(of(mockResponse));
    component.onConfirmBooking();
    fixture.detectChanges();

    expect(appointmentsServiceSpy.bookAppointment).toHaveBeenCalledWith({
      slotId: slot.id,
      reasonForVisit: 'Routine health checkup',
    });
    expect(component.bookingSuccess()).toEqual(mockResponse);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.confirmation-card')).toBeTruthy();
    expect(element.textContent).toContain('Appointment Confirmed!');
  });

  it('should handle conflict response (409) when a slot becomes unavailable', () => {
    const slot = component.filteredSlots()[0];
    component.onSelectSlot(slot);

    const conflictError = new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: { message: 'This slot is now fully booked. Please select another slot.' },
    });

    appointmentsServiceSpy.bookAppointment.and.returnValue(throwError(() => conflictError));
    component.onConfirmBooking();
    fixture.detectChanges();

    expect(component.bookingConflictError()).toContain('fully booked');
    // Verifies that loadSlots was called to refresh slots after conflict
    expect(slotsServiceSpy.getSlots).toHaveBeenCalledTimes(2);
  });
});

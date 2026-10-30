import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingsComponent } from './bookings.component';

describe('BookingsComponent', () => {
  let component: BookingsComponent;
  let fixture: ComponentFixture<BookingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should showcase available slots by default', () => {
    const slots = fixture.nativeElement.querySelectorAll('.slot-card');
    expect(slots.length).toBeGreaterThan(0);
  });

  it('should display the single clinic doctor profile header', () => {
    const doctorCard = fixture.nativeElement.querySelector('.doctor-banner-card');
    expect(doctorCard).toBeTruthy();
    expect(doctorCard.textContent).toContain(component.clinicDoctor);
  });

  it('should filter slots by morning and afternoon sessions', () => {
    component.onFilterSession('Morning');
    fixture.detectChanges();

    const morningCount = component.filteredSlots().length;
    expect(morningCount).toBeGreaterThan(0);
    expect(component.filteredSlots().every((s) => s.session === 'Morning')).toBeTrue();

    component.onFilterSession('Afternoon');
    fixture.detectChanges();

    expect(component.filteredSlots().every((s) => s.session === 'Afternoon')).toBeTrue();
  });

  it('should select an available slot and display in the booking summary', () => {
    const bookableSlot = component.mockSlots.find((s) => s.isBookable);
    expect(bookableSlot).toBeDefined();

    if (bookableSlot) {
      component.onSelectSlot(bookableSlot);
      fixture.detectChanges();

      expect(component.selectedSlotId()).toBe(bookableSlot.id);
      expect(component.selectedSlot()?.id).toBe(bookableSlot.id);

      const summaryCard = fixture.nativeElement.querySelector('.summary-card');
      expect(summaryCard.textContent).toContain(bookableSlot.timeRange);
    }
  });

  it('should not allow selecting an unavailable slot', () => {
    const unavailableSlot = component.mockSlots.find((s) => !s.isBookable);
    expect(unavailableSlot).toBeDefined();

    if (unavailableSlot) {
      component.onSelectSlot(unavailableSlot);
      fixture.detectChanges();

      expect(component.selectedSlotId()).toBeNull();
    }
  });
});


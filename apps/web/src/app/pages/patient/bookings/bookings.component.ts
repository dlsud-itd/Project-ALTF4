import { Component, computed, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';

export type BookingSlotItem = {
  id: number;
  timeRange: string;
  session: 'Morning' | 'Afternoon';
  consultationType: string;
  totalCapacity: number;
  remainingCapacity: number;
  isBookable: boolean;
};

export type CalendarDay = {
  id: string;
  dayName: string;
  dateNumber: string;
  monthName: string;
  fullDate: string;
};

// Patient interface for browsing clinic consultation schedules and showcasing available booking slots.
@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [Button, Tag],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent {
  // Single clinic doctor profile
  readonly clinicDoctor = 'Dr. Maria Santos, MD';
  readonly doctorSpecialty = 'University Clinic Physician';
  readonly clinicLocation = 'DLSU-D University Health Services Clinic';

  // Mock calendar days for template preview
  readonly availableDates: CalendarDay[] = [
    {
      id: '2026-10-31',
      dayName: 'Fri',
      dateNumber: '31',
      monthName: 'Oct',
      fullDate: 'Friday, October 31, 2026',
    },
    {
      id: '2026-11-03',
      dayName: 'Mon',
      dateNumber: '03',
      monthName: 'Nov',
      fullDate: 'Monday, November 3, 2026',
    },
    {
      id: '2026-11-04',
      dayName: 'Tue',
      dateNumber: '04',
      monthName: 'Nov',
      fullDate: 'Tuesday, November 4, 2026',
    },
    {
      id: '2026-11-05',
      dayName: 'Wed',
      dateNumber: '05',
      monthName: 'Nov',
      fullDate: 'Wednesday, November 5, 2026',
    },
    {
      id: '2026-11-06',
      dayName: 'Thu',
      dateNumber: '06',
      monthName: 'Nov',
      fullDate: 'Thursday, November 6, 2026',
    },
  ];

  // Clinic consultation slots for the single clinic doctor
  readonly mockSlots: BookingSlotItem[] = [
    {
      id: 1,
      timeRange: '08:30 AM - 09:00 AM',
      session: 'Morning',
      consultationType: 'General Medical Consultation',
      totalCapacity: 5,
      remainingCapacity: 4,
      isBookable: true,
    },
    {
      id: 2,
      timeRange: '09:00 AM - 09:30 AM',
      session: 'Morning',
      consultationType: 'General Medical Consultation',
      totalCapacity: 5,
      remainingCapacity: 2,
      isBookable: true,
    },
    {
      id: 3,
      timeRange: '09:30 AM - 10:00 AM',
      session: 'Morning',
      consultationType: 'Follow-up & Prescription Refill',
      totalCapacity: 4,
      remainingCapacity: 1,
      isBookable: true,
    },
    {
      id: 4,
      timeRange: '10:00 AM - 10:30 AM',
      session: 'Morning',
      consultationType: 'General Medical Consultation',
      totalCapacity: 5,
      remainingCapacity: 0,
      isBookable: false,
    },
    {
      id: 5,
      timeRange: '10:30 AM - 11:00 AM',
      session: 'Morning',
      consultationType: 'Medical Clearance & Certificate',
      totalCapacity: 5,
      remainingCapacity: 4,
      isBookable: true,
    },
    {
      id: 6,
      timeRange: '01:00 PM - 01:30 PM',
      session: 'Afternoon',
      consultationType: 'General Medical Consultation',
      totalCapacity: 5,
      remainingCapacity: 3,
      isBookable: true,
    },
    {
      id: 7,
      timeRange: '01:30 PM - 02:00 PM',
      session: 'Afternoon',
      consultationType: 'Follow-up & Health Assessment',
      totalCapacity: 4,
      remainingCapacity: 2,
      isBookable: true,
    },
    {
      id: 8,
      timeRange: '02:00 PM - 02:30 PM',
      session: 'Afternoon',
      consultationType: 'General Medical Consultation',
      totalCapacity: 5,
      remainingCapacity: 0,
      isBookable: false,
    },
    {
      id: 9,
      timeRange: '03:00 PM - 03:30 PM',
      session: 'Afternoon',
      consultationType: 'Medical Clearance & Certificate',
      totalCapacity: 5,
      remainingCapacity: 4,
      isBookable: true,
    },
  ];

  readonly selectedDateId = signal<string>('2026-10-31');
  readonly selectedSession = signal<'ALL' | 'Morning' | 'Afternoon'>('ALL');
  readonly selectedSlotId = signal<number | null>(null);

  // Computed selected date details
  readonly activeDate = computed((): CalendarDay => {
    const found = this.availableDates.find(
      (d: CalendarDay): boolean => d.id === this.selectedDateId(),
    );
    return found ?? this.availableDates[0];
  });

  // Filtered slots list according to active session filter
  readonly filteredSlots = computed((): BookingSlotItem[] => {
    const session = this.selectedSession();
    if (session === 'ALL') {
      return this.mockSlots;
    }
    return this.mockSlots.filter(
      (slot: BookingSlotItem): boolean => slot.session === session,
    );
  });

  // Currently selected slot entity for appointment summary preview
  readonly selectedSlot = computed((): BookingSlotItem | null => {
    const id = this.selectedSlotId();
    if (id === null) return null;
    return this.mockSlots.find((s: BookingSlotItem): boolean => s.id === id) ?? null;
  });

  // Counts available slots
  readonly availableCount = computed((): number => {
    return this.filteredSlots().filter((s: BookingSlotItem): boolean => s.isBookable).length;
  });

  onSelectDate(dateId: string): void {
    this.selectedDateId.set(dateId);
    this.selectedSlotId.set(null);
  }

  onFilterSession(session: 'ALL' | 'Morning' | 'Afternoon'): void {
    this.selectedSession.set(session);
  }

  onSelectSlot(slot: BookingSlotItem): void {
    if (!slot.isBookable) {
      return;
    }
    this.selectedSlotId.set(slot.id);
  }

  onClearSelection(): void {
    this.selectedSlotId.set(null);
  }
}

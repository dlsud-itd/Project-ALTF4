import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { ClinicSlot, PatientAppointment } from '@core/models';
import { SlotsService, AppointmentsService } from '@core/services';
import { getErrorMessage, toDateParam } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

export type DisplaySlotItem = {
  id: number;
  timeRange: string;
  startTime: string;
  endTime: string;
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

const LOOKAHEAD_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const [hoursStr, minsStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${minsStr} ${period}`;
}

function parseCalendarDay(dateStr: string): CalendarDay {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dateNumber = String(d).padStart(2, '0');
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  const fullDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return { id: dateStr, dayName, dateNumber, monthName, fullDate };
}

// Patient interface for browsing clinic consultation schedules and booking appointments.
@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [
    RouterLink,
    Button,
    Message,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent implements OnInit {
  private readonly slotsService = inject(SlotsService);
  private readonly appointmentsService = inject(AppointmentsService);

  // Single clinic doctor profile
  readonly clinicDoctor = 'Dr. Maria Santos, MD';
  readonly doctorSpecialty = 'University Clinic Physician';
  readonly clinicLocation = 'DLSU-D University Health Services Clinic';

  // Live slots and loading state
  readonly rawSlots = signal<ClinicSlot[]>([]);
  readonly isLoadingSlots = signal<boolean>(false);
  readonly slotsError = signal<string | null>(null);

  // Selection state
  readonly selectedDateId = signal<string>('');
  readonly selectedSession = signal<'ALL' | 'Morning' | 'Afternoon'>('ALL');
  readonly selectedSlotId = signal<number | null>(null);
  readonly reasonForVisit = signal<string>('');

  // Booking action state
  readonly isBooking = signal<boolean>(false);
  readonly bookingSuccess = signal<{
    message: string;
    appointment: PatientAppointment;
  } | null>(null);
  readonly bookingConflictError = signal<string | null>(null);
  readonly bookingGeneralError = signal<string | null>(null);

  // Only bookable slots with available capacity are shown to patients
  readonly availableSlots = computed((): ClinicSlot[] => {
    return this.rawSlots().filter(
      (slot: ClinicSlot): boolean => slot.isBookable && slot.remainingCapacity > 0,
    );
  });

  // Calendar dates derived dynamically from available slots
  readonly availableDates = computed((): CalendarDay[] => {
    const slots = this.availableSlots();
    const dateSet = new Set<string>();
    for (const slot of slots) {
      dateSet.add(slot.clinicDate);
    }
    const sortedDates = Array.from(dateSet).sort();
    return sortedDates.map(parseCalendarDay);
  });

  // Active date object for display
  readonly activeDate = computed((): CalendarDay => {
    const dates = this.availableDates();
    if (dates.length === 0) {
      const today = toDateParam(new Date());
      return parseCalendarDay(today);
    }
    const found = dates.find(
      (d: CalendarDay): boolean => d.id === this.selectedDateId(),
    );
    return found ?? dates[0];
  });

  // Filtered slots for the chosen date and session
  readonly filteredSlots = computed((): DisplaySlotItem[] => {
    const activeDateId = this.activeDate().id;
    const session = this.selectedSession();

    const dateSlots = this.availableSlots().filter(
      (slot: ClinicSlot): boolean => slot.clinicDate === activeDateId,
    );

    const mapped: DisplaySlotItem[] = dateSlots.map((slot) => {
      const slotSession: 'Morning' | 'Afternoon' =
        slot.startTime < '12:00' ? 'Morning' : 'Afternoon';
      const timeRange = `${formatTime12h(slot.startTime)} - ${formatTime12h(slot.endTime)}`;

      return {
        id: slot.id,
        timeRange,
        startTime: slot.startTime,
        endTime: slot.endTime,
        session: slotSession,
        consultationType: 'General Medical Consultation',
        totalCapacity: slot.capacity,
        remainingCapacity: slot.remainingCapacity,
        isBookable: slot.isBookable && slot.remainingCapacity > 0,
      };
    });

    if (session === 'ALL') {
      return mapped;
    }
    return mapped.filter((s: DisplaySlotItem): boolean => s.session === session);
  });

  // Currently selected slot entity for appointment summary preview
  readonly selectedSlot = computed((): DisplaySlotItem | null => {
    const id = this.selectedSlotId();
    if (id === null) return null;
    return this.filteredSlots().find((s: DisplaySlotItem): boolean => s.id === id) ?? null;
  });

  // Counts available slots for current filter
  readonly availableCount = computed((): number => {
    return this.filteredSlots().length;
  });

  ngOnInit(): void {
    this.loadSlots();
  }

  loadSlots(): void {
    const today = new Date();
    const end = new Date(today.getTime() + LOOKAHEAD_DAYS * MS_PER_DAY);

    this.isLoadingSlots.set(true);
    this.slotsError.set(null);

    this.slotsService
      .getSlots(toDateParam(today), toDateParam(end), true)
      .subscribe({
        next: (response): void => {
          this.rawSlots.set(response.slots);
          this.isLoadingSlots.set(false);

          // If no date currently selected or active date has no slots, default to first available
          const dates = this.availableDates();
          if (dates.length > 0 && (!this.selectedDateId() || !dates.some(d => d.id === this.selectedDateId()))) {
            this.selectedDateId.set(dates[0].id);
          }
        },
        error: (err: HttpErrorResponse): void => {
          this.slotsError.set(
            getErrorMessage(err, 'Could not load available clinic slots.'),
          );
          this.isLoadingSlots.set(false);
        },
      });
  }

  onSelectDate(dateId: string): void {
    this.selectedDateId.set(dateId);
    this.selectedSlotId.set(null);
    this.clearErrors();
  }

  onFilterSession(session: 'ALL' | 'Morning' | 'Afternoon'): void {
    this.selectedSession.set(session);
    this.selectedSlotId.set(null);
  }

  onSelectSlot(slot: DisplaySlotItem): void {
    this.selectedSlotId.set(slot.id);
    this.clearErrors();
  }

  onClearSelection(): void {
    this.selectedSlotId.set(null);
    this.clearErrors();
  }

  onReasonInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.reasonForVisit.set(target.value);
  }

  onConfirmBooking(): void {
    const slot = this.selectedSlot();
    if (!slot) return;

    this.isBooking.set(true);
    this.clearErrors();

    this.appointmentsService
      .bookAppointment({
        slotId: slot.id,
        reasonForVisit: this.reasonForVisit().trim() || undefined,
      })
      .subscribe({
        next: (response): void => {
          this.isBooking.set(false);
          this.bookingSuccess.set(response);
          this.selectedSlotId.set(null);
          this.reasonForVisit.set('');
          this.loadSlots();
        },
        error: (err: HttpErrorResponse): void => {
          this.isBooking.set(false);
          if (err.status === 409) {
            this.bookingConflictError.set(
              getErrorMessage(
                err,
                'This slot is no longer available or was just filled. Please select another slot.',
              ),
            );
            // Refresh slots to eliminate the full slot
            this.loadSlots();
          } else {
            this.bookingGeneralError.set(
              getErrorMessage(err, 'Failed to book appointment. Please try again.'),
            );
          }
        },
      });
  }

  onBookAnother(): void {
    this.bookingSuccess.set(null);
    this.selectedSlotId.set(null);
    this.reasonForVisit.set('');
    this.clearErrors();
    this.loadSlots();
  }

  private clearErrors(): void {
    this.bookingConflictError.set(null);
    this.bookingGeneralError.set(null);
  }
}

import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { ClinicSlot, PatientAppointment } from '@core/models';
import {
  SlotsService,
  AppointmentsService,
  AppConfirmService,
  PatientAppointmentsStore,
} from '@core/services';
import { getErrorMessage, requiredTextValidator, toDateParam } from '@core/utils';
import {
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

type SlotLoadResult =
  | { slots: ClinicSlot[] }
  | { error: HttpErrorResponse };

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
    Dialog,
    Message,
    Tag,
    ReactiveFormsModule,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent implements OnInit {
  private readonly slotsService = inject(SlotsService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly appointmentsStore = inject(PatientAppointmentsStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmService = inject(AppConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly slotReload$ = new Subject<void>();

  constructor() {
    this.slotReload$
      .pipe(
        switchMap(() => {
          const today = new Date();
          const end = new Date(today.getTime() + LOOKAHEAD_DAYS * MS_PER_DAY);
          return this.slotsService
            .getSlots(toDateParam(today), toDateParam(end), true)
            .pipe(
              map((response): SlotLoadResult => ({ slots: response.slots })),
              catchError((error: HttpErrorResponse) =>
                of<SlotLoadResult>({ error }),
              ),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result): void => {
        this.isLoadingSlots.set(false);
        if ('error' in result) {
          this.slotsError.set(
            getErrorMessage(
              result.error,
              'Could not load available clinic slots.',
            ),
          );
          return;
        }

        this.rawSlots.set(result.slots);
        const dates = this.availableDates();
        if (
          dates.length > 0 &&
          (!this.selectedDateId() ||
            !dates.some((date) => date.id === this.selectedDateId()))
        ) {
          this.selectedDateId.set(dates[0].id);
        }
      });
  }

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
  readonly bookingForm = this.formBuilder.nonNullable.group({
    reasonForVisit: ['', [requiredTextValidator]],
  });
  private readonly reasonValue = toSignal(
    this.bookingForm.controls.reasonForVisit.valueChanges,
    { initialValue: this.bookingForm.controls.reasonForVisit.value },
  );
  readonly reasonForVisit = computed((): string => this.reasonValue());

  // Booking action state
  readonly isBooking = signal<boolean>(false);
  readonly bookingSuccess = signal<{
    message: string;
    appointment: PatientAppointment;
  } | null>(null);
  readonly bookingConflictError = signal<string | null>(null);
  readonly bookingGeneralError = signal<string | null>(null);
  readonly isReviewModalOpen = signal<boolean>(false);

  // Appointment being moved when the page is opened with ?reschedule=<id>.
  readonly rescheduleId = signal<number | null>(null);
  readonly rescheduleSuccess = signal<boolean>(false);
  readonly isRescheduling = computed((): boolean => this.rescheduleId() !== null);

  readonly isConfirmDisabled = computed((): boolean => {
    if (this.isBooking()) return true;
    if (this.isRescheduling()) return false;
    this.reasonValue();
    return this.bookingForm.controls.reasonForVisit.invalid;
  });

  // Only bookable slots with available capacity are shown to patients
  readonly availableSlots = computed((): ClinicSlot[] => {
    return this.rawSlots().filter(
      (slot: ClinicSlot): boolean =>
        slot.isBookable && slot.remainingCapacity > 0 && !slot.isExpired,
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
    const rescheduleParam = this.route.snapshot.queryParamMap.get('reschedule');
    const rescheduleId = Number(rescheduleParam);
    if (rescheduleParam && Number.isInteger(rescheduleId) && rescheduleId > 0) {
      this.rescheduleId.set(rescheduleId);
    }
    this.loadSlots();
  }

  loadSlots(): void {
    this.isLoadingSlots.set(true);
    this.slotsError.set(null);
    this.slotReload$.next();
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

  onConfirmBooking(): void {
    const slot = this.selectedSlot();
    if (!slot) return;

    if (!this.isRescheduling() && this.bookingForm.controls.reasonForVisit.invalid) {
      this.bookingForm.controls.reasonForVisit.markAsTouched();
      return;
    }

    this.isReviewModalOpen.set(true);
  }

  onReviewModalVisibleChange(visible: boolean): void {
    this.isReviewModalOpen.set(visible);
  }

  executeConfirmedBooking(): void {
    const slot = this.selectedSlot();
    if (!slot) return;

    this.isReviewModalOpen.set(false);

    const rescheduleId = this.rescheduleId();
    if (rescheduleId !== null) {
      this.onConfirmReschedule(rescheduleId, slot);
      return;
    }

    const trimmedReason = this.bookingForm.controls.reasonForVisit.value.trim();
    if (!trimmedReason) return;

    this.executeBooking(slot, trimmedReason);
  }

  private executeBooking(slot: DisplaySlotItem, reason: string): void {
    this.isBooking.set(true);
    this.clearErrors();

    this.appointmentsService
      .bookAppointment({
        slotId: slot.id,
        reasonForVisit: reason,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response): void => {
          this.appointmentsStore.load();
          this.isBooking.set(false);
          this.bookingSuccess.set(response);
          this.selectedSlotId.set(null);
          this.bookingForm.reset();
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
    this.rescheduleSuccess.set(false);
    this.selectedSlotId.set(null);
    this.bookingForm.reset();
    this.clearErrors();
    this.loadSlots();
  }

  // Moves the appointment from the query parameter into the chosen slot.
  private onConfirmReschedule(appointmentId: number, slot: DisplaySlotItem): void {
    this.isBooking.set(true);
    this.clearErrors();

    this.appointmentsService
      .rescheduleAppointment(appointmentId, { slotId: slot.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response): void => {
          this.appointmentsStore.load();
          this.isBooking.set(false);
          this.rescheduleSuccess.set(true);
          this.bookingSuccess.set(response);
          this.selectedSlotId.set(null);
          this.rescheduleId.set(null);
          this.loadSlots();
        },
        error: (err: HttpErrorResponse): void => {
          this.isBooking.set(false);
          if (err.status === 409) {
            this.bookingConflictError.set(
              getErrorMessage(
                err,
                'This slot is no longer available. Please select another slot.',
              ),
            );
            this.loadSlots();
          } else {
            this.bookingGeneralError.set(
              getErrorMessage(err, 'Failed to reschedule appointment. Please try again.'),
            );
          }
        },
      });
  }

  private clearErrors(): void {
    this.bookingConflictError.set(null);
    this.bookingGeneralError.set(null);
  }
}

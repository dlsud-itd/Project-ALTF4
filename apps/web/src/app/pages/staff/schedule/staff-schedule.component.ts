import {
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import {
  BlockDayValue,
  ClinicSlot,
  SlotFormValue,
  SlotsResponse,
  SlotStatus,
} from '@core/models';
import { SlotsService } from '@core/services';
import { StaffLayoutComponent } from '../../../layouts/staff-layout/staff-layout.component';
import {
  formatTime12h,
  formatTimeRange,
  getErrorMessage,
  getHolidayName,
  getSlotStatus,
  latestScheduleDate,
  toDateParam,
  toTimeParam,
} from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import { SlotFormComponent } from './slot-form/slot-form.component';
import { BlockDayFormComponent } from './block-day/block-day-form.component';
import {
  catchError,
  concatMap,
  from,
  map,
  of,
  Subject,
  switchMap,
  toArray,
} from 'rxjs';

const LOAD_ERROR_FALLBACK = 'Could not load the clinic schedule.';
const SAVE_ERROR_FALLBACK = 'Could not save the slot. Please try again.';
const DELETE_ERROR_FALLBACK = 'Could not delete the slot. Please try again.';
const BLOCK_ERROR_FALLBACK = 'Could not change the slot status.';
// Replaces the API's developer wording for deleting a booked slot (409).
const BOOKED_SLOT_DELETE_ERROR =
  'This slot has active appointments, so it cannot be deleted. Block it instead.';

// How long the floating slot error stays on screen.
const ERROR_DISMISS_MS = 5000;

// Add day mirrors the API's default schedule (slot-generation.service.ts):
// half-hour slots from 08:00 to 17:00, skipping the 12:00 lunch hour.
const DAY_SLOT_HOURS: readonly number[] = [8, 9, 10, 11, 13, 14, 15, 16];
const DAY_SLOT_CAPACITY = 1;
const toHourTime = (hour: number, minutes: number): string =>
  `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
const DEFAULT_DAY_SLOTS = DAY_SLOT_HOURS.flatMap((hour) => [
  { startTime: toHourTime(hour, 0), endTime: toHourTime(hour, 30) },
  { startTime: toHourTime(hour, 30), endTime: toHourTime(hour + 1, 0) },
]);

type TagSeverity = 'success' | 'warn' | 'secondary';
type SlotFilter = 'ALL' | 'open' | 'full' | 'closed' | 'expired';
type ScheduleView = 'day' | 'slot' | 'calendar';
// The action waiting for the staff member to pick a calendar day.
type PickMode = 'block' | 'add';
interface CalendarDay {
  date: string;
  dayNumber: number;
  isInMonth: boolean;
  isPast: boolean;
  isBeyondLimit: boolean;
  holiday: string | null;
  isToday: boolean;
  slotCount: number;
  label: string;
  tone: SlotStatus | 'none';
}
// One day of slots; other views use a single group with no date.
interface SlotGroup {
  date: string | null;
  slots: ClinicSlot[];
  timeRange: string;
  openCount: number;
  isExpanded: boolean;
}
type SlotLoadResult =
  | { response: SlotsResponse }
  | { error: HttpErrorResponse };

const STATUS_LABELS: Record<SlotStatus, string> = {
  open: 'Open',
  full: 'Full',
  closed: 'Closed',
  expired: 'Expired',
};

const STATUS_SEVERITIES: Record<SlotStatus, TagSeverity> = {
  open: 'success',
  full: 'warn',
  closed: 'secondary',
  expired: 'secondary',
};

// Staff view listing clinic slots with capacity and open/full/closed status.
@Component({
  selector: 'app-staff-schedule',
  standalone: true,
  imports: [
    Button,
    ConfirmDialog,
    NgTemplateOutlet,
    Message,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
    SlotFormComponent,
    BlockDayFormComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './staff-schedule.component.html',
  styleUrl: './staff-schedule.component.scss',
})
export class StaffScheduleComponent implements OnInit {
  private readonly slotsService: SlotsService = inject(SlotsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationService: ConfirmationService =
    inject(ConfirmationService);
  private readonly reloadSlots$ = new Subject<void>();
  private readonly reloadCalendar$ = new Subject<void>();
  // The surrounding layout; absent when the page is rendered on its own.
  private readonly layout = inject(StaffLayoutComponent, { optional: true });

  constructor() {
    // The sidebar makes room for the whole Calendar view.
    effect(() => {
      const isCalendar: boolean = this.view() === 'calendar';
      untracked(() => this.layout?.setSidePanelOpen(isCalendar));
    });
    this.destroyRef.onDestroy(() => this.layout?.setSidePanelOpen(false));

    // Clears the floating error after a delay; closing it or showing a new
    // one cancels the previous timer.
    effect((onCleanup) => {
      if (this.deleteError() === null) {
        return;
      }
      const timer = setTimeout(
        () => this.deleteError.set(null),
        ERROR_DISMISS_MS,
      );
      onCleanup(() => clearTimeout(timer));
    });

    this.reloadCalendar$
      .pipe(
        switchMap(() => {
          const month: Date = this.calendarMonth();
          const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
          return this.slotsService
            .getSlots(toDateParam(month), toDateParam(lastDay))
            .pipe(
              map((response): SlotLoadResult => ({ response })),
              catchError((error: HttpErrorResponse) =>
                of<SlotLoadResult>({ error }),
              ),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result): void => {
        if ('error' in result) {
          this.deleteError.set(
            getErrorMessage(result.error, LOAD_ERROR_FALLBACK),
          );
          return;
        }
        this.calendarSlots.set(result.response.slots);
      });

    this.reloadSlots$
      .pipe(
        switchMap(() => {
          // Reaches the scheduling limit, so days added from the calendar
          // show up in By slot and By day too.
          return this.slotsService
            .getSlots(toDateParam(new Date()), toDateParam(latestScheduleDate()))
            .pipe(
              map((response): SlotLoadResult => ({ response })),
              catchError((error: HttpErrorResponse) =>
                of<SlotLoadResult>({ error }),
              ),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result): void => {
        this.isLoading.set(false);
        if ('error' in result) {
          this.errorMessage.set(
            getErrorMessage(result.error, LOAD_ERROR_FALLBACK),
          );
          return;
        }
        this.slots.set(result.response.slots);
      });
  }

  readonly slots = signal<ClinicSlot[]>([]);
  readonly statusFilter = signal<SlotFilter>('ALL');
  readonly filteredSlots = computed(() => this.sortAndFilter(this.slots()));
  // The calendar loads a whole month, separately from the two-week lists.
  readonly calendarSlots = signal<ClinicSlot[]>([]);
  readonly calendarMonth = signal<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  private readonly filteredCalendarSlots = computed(() =>
    this.sortAndFilter(this.calendarSlots()),
  );
  // The page always opens on By day.
  readonly view = signal<ScheduleView>('day');
  // Days the user has opened or closed, keyed by date.
  private readonly dayToggles = signal<Record<string, boolean>>({});
  readonly slotGroups = computed<SlotGroup[]>(() => {
    const slots: ClinicSlot[] = this.filteredSlots();
    if (this.view() !== 'day') {
      return [
        {
          date: null,
          slots,
          timeRange: '',
          openCount: 0,
          isExpanded: true,
        },
      ];
    }

    const slotsByDate = new Map<string, ClinicSlot[]>();
    for (const slot of slots) {
      const daySlots = slotsByDate.get(slot.clinicDate) ?? [];
      daySlots.push(slot);
      slotsByDate.set(slot.clinicDate, daySlots);
    }

    // Every day starts collapsed.
    const toggles = this.dayToggles();

    return [...slotsByDate].map(([date, daySlots]) => ({
      date,
      slots: daySlots,
      timeRange: this.dayTimeRange(daySlots),
      openCount: daySlots.filter((slot) => getSlotStatus(slot) === 'open')
        .length,
      isExpanded: toggles[date] ?? false,
    }));
  });
  // The Status heading is only needed while slot rows are on screen.
  // By slot and Calendar have a single group that is always expanded.
  readonly hasVisibleSlotRows = computed<boolean>(() =>
    this.slotGroups().some((group) => group.isExpanded),
  );
  // The whole month in Monday-first weeks, padded with neighbouring days.
  readonly calendarDays = computed<CalendarDay[]>(() => {
    const month: Date = this.calendarMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const leadingDays = (month.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
    const today: string = toDateParam(new Date());

    return Array.from({ length: cellCount }, (_, index): CalendarDay => {
      const day = new Date(year, monthIndex, index - leadingDays + 1);
      const date: string = toDateParam(day);
      const daySlots = this.filteredCalendarSlots().filter(
        (slot) => slot.clinicDate === date,
      );
      return {
        date,
        dayNumber: day.getDate(),
        isInMonth: day.getMonth() === monthIndex,
        isPast: date < today,
        isBeyondLimit: date > toDateParam(latestScheduleDate()),
        holiday: getHolidayName(date),
        isToday: date === today,
        slotCount: daySlots.length,
        ...this.describeCalendarDay(daySlots),
      };
    });
  });
  readonly calendarTitle = computed<string>(() =>
    this.calendarMonth().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
  );
  // The calendar date shown in the side panel; null while it is closed.
  readonly selectedDate = signal<string | null>(null);
  readonly selectedDaySlots = computed<ClinicSlot[]>(() =>
    this.filteredCalendarSlots().filter(
      (slot) => slot.clinicDate === this.selectedDate(),
    ),
  );
  readonly pickMode = signal<PickMode | null>(null);
  readonly isAddingDay = signal<boolean>(false);
  // Date filled into the form when adding a slot from the day panel.
  readonly newSlotDate = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isFormOpen = signal<boolean>(false);
  readonly editingSlot = signal<ClinicSlot | null>(null);
  readonly isSaving = signal<boolean>(false);
  readonly saveError = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly isDayFormOpen = signal<boolean>(false);
  readonly isDaySaving = signal<boolean>(false);
  readonly dayError = signal<string | null>(null);
  readonly blockingSlotId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadSlots();
  }

  onAddSlot(): void {
    this.openForm(null);
  }

  setStatusFilter(value: string): void {
    const filters: readonly SlotFilter[] = [
      'ALL',
      'open',
      'full',
      'closed',
      'expired',
    ];
    const filter = filters.find((candidate) => candidate === value);
    if (filter) {
      this.statusFilter.set(filter);
    }
  }

  onStatusFilterChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    this.setStatusFilter(target.value);
  }

  onViewChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    this.setView(this.toScheduleView(target.value));
  }

  setView(view: ScheduleView): void {
    this.view.set(view);
    this.dayToggles.set({});
    this.selectedDate.set(null);
    this.pickMode.set(null);
    if (view === 'calendar') {
      this.reloadCalendar$.next();
    }
  }

  onSelectDate(date: string): void {
    this.selectedDate.set(date);
  }

  // Starts or cancels picking a day for Block day or Add day.
  onTogglePickMode(mode: PickMode): void {
    this.pickMode.update((current) => (current === mode ? null : mode));
    this.selectedDate.set(null);
  }

  @HostListener('document:keydown.escape')
  onCancelPick(): void {
    this.pickMode.set(null);
  }

  // A day click opens its panel, unless an action is waiting for a day.
  onCalendarDayClick(date: string): void {
    const mode: PickMode | null = this.pickMode();
    if (mode === 'add') {
      this.confirmAddOnDate(date);
    } else if (mode === 'block') {
      this.confirmBlockOnDate(date);
    } else {
      this.onSelectDate(date);
    }
  }

  onAddSlotOnDate(date: string): void {
    this.openForm(null);
    this.newSlotDate.set(date);
  }

  onDayPanelClose(): void {
    this.selectedDate.set(null);
  }

  // The calendar cannot go back before the current month.
  readonly canViewPreviousMonth = computed<boolean>(
    () => toDateParam(this.calendarMonth()) > toDateParam(new Date()),
  );

  // Nor can it go past the month holding the scheduling limit.
  readonly canViewNextMonth = computed<boolean>(() => {
    const month: Date = this.calendarMonth();
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return nextMonth <= latestScheduleDate();
  });

  // Moves the calendar back or forward and loads that month.
  onChangeMonth(offset: number): void {
    const canMove: boolean =
      offset < 0 ? this.canViewPreviousMonth() : this.canViewNextMonth();
    if (!canMove) {
      return;
    }
    this.calendarMonth.update(
      (month) => new Date(month.getFullYear(), month.getMonth() + offset, 1),
    );
    this.selectedDate.set(null);
    this.calendarSlots.set([]);
    this.reloadCalendar$.next();
  }

  onToggleDay(date: string, isExpanded: boolean): void {
    this.dayToggles.update((toggles) => ({
      ...toggles,
      [date]: !isExpanded,
    }));
  }

  onEditSlot(slot: ClinicSlot): void {
    this.openForm(slot);
  }

  onFormCancel(): void {
    this.isFormOpen.set(false);
  }

  // Creates or updates the slot, then closes the form and refreshes the list.
  // The API's validation and conflict messages are shown inside the form.
  onFormSave(value: SlotFormValue): void {
    const slot: ClinicSlot | null = this.editingSlot();
    const request$ = slot
      ? this.slotsService.updateSlot(slot.id, value)
      : this.slotsService.createSlot(value);
    this.isSaving.set(true);
    this.saveError.set(null);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (): void => {
        this.isSaving.set(false);
        this.isFormOpen.set(false);
        this.loadSlots();
      },
      error: (error: HttpErrorResponse): void => {
        this.isSaving.set(false);
        this.saveError.set(getErrorMessage(error, SAVE_ERROR_FALLBACK));
      },
    });
  }

  // Asks for confirmation before deleting the slot.
  onDeleteSlot(slot: ClinicSlot): void {
    this.confirmationService.confirm({
      header: 'Delete slot',
      message: `Delete the ${slot.clinicDate} slot at ${this.formatTime(slot.startTime)}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => this.onConfirmDelete(slot),
    });
  }

  // Deletes the slot and reloads; a slot with bookings returns a 409.
  onConfirmDelete(slot: ClinicSlot): void {
    this.deleteError.set(null);
    this.slotsService
      .deleteSlot(slot.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (): void => this.loadSlots(),
      error: (error: HttpErrorResponse): void => {
        this.deleteError.set(
          error.status === 409
            ? BOOKED_SLOT_DELETE_ERROR
            : getErrorMessage(error, DELETE_ERROR_FALLBACK),
        );
      },
    });
  }

  onOpenBlockDay(): void {
    this.dayError.set(null);
    this.isDayFormOpen.set(true);
  }

  onDayFormCancel(): void {
    this.isDayFormOpen.set(false);
  }

  // Blocks or reopens every upcoming slot on the chosen date.
  onDayFormSave(value: BlockDayValue): void {
    this.dayError.set(null);
    const holiday: string | null = getHolidayName(value.clinicDate);
    if (!value.isBlocked && holiday) {
      this.dayError.set(`The clinic is closed for ${holiday}.`);
      return;
    }
    this.isDaySaving.set(true);
    this.slotsService
      .blockDay(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => {
          this.isDaySaving.set(false);
          this.isDayFormOpen.set(false);
          this.loadSlots();
        },
        error: (error: HttpErrorResponse): void => {
          this.isDaySaving.set(false);
          this.dayError.set(getErrorMessage(error, BLOCK_ERROR_FALLBACK));
        },
      });
  }

  // Toggles a single slot between open and closed for booking.
  onToggleSlotBlock(slot: ClinicSlot): void {
    this.blockingSlotId.set(slot.id);
    this.deleteError.set(null);
    this.slotsService
      .blockSlot(slot.id, { isBlocked: this.isSlotOpen(slot) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => {
          this.blockingSlotId.set(null);
          this.loadSlots();
        },
        error: (error: HttpErrorResponse): void => {
          this.blockingSlotId.set(null);
          this.deleteError.set(getErrorMessage(error, BLOCK_ERROR_FALLBACK));
        },
      });
  }

  // Blocking a slot with bookings notifies those patients, so ask first.
  onRequestSlotBlock(slot: ClinicSlot): void {
    if (!this.isSlotOpen(slot) && this.rejectHoliday(slot.clinicDate)) {
      return;
    }
    const booked: number = slot.capacity - slot.remainingCapacity;
    if (!this.isSlotOpen(slot) || booked === 0) {
      this.onToggleSlotBlock(slot);
      return;
    }

    this.confirmationService.confirm({
      header: 'Block slot',
      message: `Block the ${slot.clinicDate} slot at ${this.formatTime(slot.startTime)}? ${booked} booked patient(s) will be notified to reschedule.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Block slot',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => this.onToggleSlotBlock(slot),
    });
  }

  // Earliest start to latest end among a day's slots.
  private dayTimeRange(slots: ClinicSlot[]): string {
    const starts: string[] = slots.map((slot) => slot.startTime).sort();
    const ends: string[] = slots.map((slot) => slot.endTime).sort();
    return formatTimeRange(starts[0], ends[ends.length - 1]);
  }

  // Anything unrecognised falls back to By day.
  private toScheduleView(value: string): ScheduleView {
    return value === 'slot' || value === 'calendar' ? value : 'day';
  }

  // The most useful status first: open count, then Full, Closed or Expired.
  private describeCalendarDay(
    slots: ClinicSlot[],
  ): Pick<CalendarDay, 'label' | 'tone'> {
    const statuses: SlotStatus[] = slots.map((slot) => getSlotStatus(slot));
    const openCount = statuses.filter((status) => status === 'open').length;
    if (openCount > 0) {
      return { label: `${openCount} open`, tone: 'open' };
    }
    const tone = (['full', 'closed', 'expired'] as const).find((status) =>
      statuses.includes(status),
    );
    if (!tone) {
      return { label: '', tone: 'none' };
    }
    // Only today can reach this as expired, once its last slot has passed.
    return {
      label: tone === 'expired' ? 'Ended' : STATUS_LABELS[tone],
      tone,
    };
  }

  private sortAndFilter(slots: ClinicSlot[]): ClinicSlot[] {
    return [...slots]
      .sort(
        (left, right) =>
          left.clinicDate.localeCompare(right.clinicDate) ||
          left.startTime.localeCompare(right.startTime),
      )
      .filter(
        (slot) =>
          this.statusFilter() === 'ALL' ||
          getSlotStatus(slot) === this.statusFilter(),
      );
  }

  // Offers to create the day's default slots, leaving existing ones alone.
  private confirmAddOnDate(date: string): void {
    if (this.rejectHoliday(date)) {
      return;
    }
    const day: string = this.formatDisplayDate(date);
    const missing: SlotFormValue[] = this.missingDaySlots(date);
    if (missing.length === 0) {
      this.deleteError.set(`There are no more slots to add on ${day}.`);
      return;
    }

    const count = `${missing.length} ${missing.length === 1 ? 'slot' : 'slots'}`;
    const weekday: number = new Date(`${date}T00:00:00`).getDay();
    const weekendNotice =
      weekday === 0 || weekday === 6 ? ' This date is on a weekend.' : '';

    this.confirmationService.confirm({
      header: 'Add day',
      message: `Are you sure you want to add ${count} on ${day}? Slots are 30 minutes each between 8:00 AM and 5:00 PM, with a 12:00 PM lunch break.${weekendNotice}`,
      icon: 'pi pi-calendar-plus',
      acceptLabel: 'Add day',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'primary' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => this.onConfirmAddDay(date, missing),
    });
  }

  // Shows why a holiday cannot be opened; false on an ordinary day.
  private rejectHoliday(date: string): boolean {
    const holiday: string | null = getHolidayName(date);
    if (holiday) {
      this.deleteError.set(`The clinic is closed for ${holiday}.`);
    }
    return holiday !== null;
  }

  holidayName(date: string): string | null {
    return getHolidayName(date);
  }

  // Default slots that do not overlap an existing one or start in the past.
  private missingDaySlots(date: string): SlotFormValue[] {
    const now = new Date();
    const isToday: boolean = date === toDateParam(now);
    const existing: ClinicSlot[] = this.calendarSlots().filter(
      (slot) => slot.clinicDate === date,
    );
    return DEFAULT_DAY_SLOTS.filter(
      ({ startTime, endTime }) =>
        !(isToday && startTime < toTimeParam(now)) &&
        !existing.some(
          (slot) => slot.startTime < endTime && slot.endTime > startTime,
        ),
    ).map((times) => ({
      clinicDate: date,
      ...times,
      capacity: DAY_SLOT_CAPACITY,
      isBookable: true,
    }));
  }

  // The API creates one slot per request, so they are sent one at a time.
  private onConfirmAddDay(date: string, slots: SlotFormValue[]): void {
    this.pickMode.set(null);
    this.deleteError.set(null);
    this.isAddingDay.set(true);
    from(slots)
      .pipe(
        concatMap((slot) =>
          this.slotsService.createSlot(slot).pipe(
            map((): string | null => null),
            catchError((error: HttpErrorResponse) =>
              of(getErrorMessage(error, SAVE_ERROR_FALLBACK)),
            ),
          ),
        ),
        toArray(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results): void => {
        this.isAddingDay.set(false);
        const failures = results.filter(
          (message): message is string => message !== null,
        );
        if (failures.length > 0) {
          this.deleteError.set(
            `${failures.length} of ${slots.length} slots could not be added. ${failures[0]}`,
          );
        }
        this.loadSlots();
        // Shows the new slots beside the calendar.
        if (this.view() === 'calendar') {
          this.onSelectDate(date);
        }
      });
  }

  // Offers to block the day, or to reopen it when every slot is closed.
  private confirmBlockOnDate(date: string): void {
    // Counts every slot that has not ended, whatever the status filter.
    const slots: ClinicSlot[] = this.calendarSlots().filter(
      (slot) => slot.clinicDate === date && !slot.isExpired,
    );
    const day: string = this.formatDisplayDate(date);
    if (slots.length === 0) {
      this.deleteError.set(`There are no upcoming slots on ${day}.`);
      return;
    }

    const isBlocking: boolean = slots.some((slot) => this.isSlotOpen(slot));
    if (!isBlocking && this.rejectHoliday(date)) {
      return;
    }
    const booked: number = slots.reduce(
      (total, slot) => total + (slot.capacity - slot.remainingCapacity),
      0,
    );
    const count = `${slots.length} ${slots.length === 1 ? 'slot' : 'slots'}`;
    const notice =
      isBlocking && booked > 0
        ? ` ${booked} booked patient(s) will be notified to reschedule.`
        : '';
    const action = isBlocking ? 'Block' : 'Reopen';

    this.confirmationService.confirm({
      header: `${action} day`,
      message: `Are you sure you want to ${action.toLowerCase()} ${day}? This affects ${count}.${notice}`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: `${action} day`,
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: isBlocking ? 'danger' : 'primary' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => this.onConfirmDayBlock(date, isBlocking),
    });
  }

  private onConfirmDayBlock(date: string, isBlocked: boolean): void {
    this.pickMode.set(null);
    this.deleteError.set(null);
    this.slotsService
      .blockDay({ clinicDate: date, isBlocked })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => this.loadSlots(),
        error: (error: HttpErrorResponse): void => {
          this.deleteError.set(getErrorMessage(error, BLOCK_ERROR_FALLBACK));
        },
      });
  }

  private openForm(slot: ClinicSlot | null): void {
    this.newSlotDate.set(null);
    this.editingSlot.set(slot);
    this.saveError.set(null);
    this.isFormOpen.set(true);
  }

  // Fetches slots from today through the lookahead window.
  loadSlots(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.reloadSlots$.next();
    // Keeps the calendar current after a slot is changed.
    if (this.view() === 'calendar') {
      this.reloadCalendar$.next();
    }
  }

  statusLabel(slot: ClinicSlot): string {
    return STATUS_LABELS[getSlotStatus(slot)];
  }

  statusSeverity(slot: ClinicSlot): TagSeverity {
    return STATUS_SEVERITIES[getSlotStatus(slot)];
  }

  // True when the slot is still open for booking (a full slot can be open).
  isSlotOpen(slot: ClinicSlot): boolean {
    return slot.isOpen ?? slot.isBookable;
  }

  formatTimeRange(startTime: string, endTime: string): string {
    return formatTimeRange(startTime, endTime);
  }

  formatTime(timeStr: string): string {
    return formatTime12h(timeStr);
  }

  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

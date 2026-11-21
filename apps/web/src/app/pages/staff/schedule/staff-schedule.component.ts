import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
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
import {
  formatTime12h,
  formatTimeRange,
  getErrorMessage,
  getSlotStatus,
  toDateParam,
} from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import { SlotFormComponent } from './slot-form/slot-form.component';
import { BlockDayFormComponent } from './block-day/block-day-form.component';
import { catchError, map, of, Subject, switchMap } from 'rxjs';

// Number of days ahead of today that the staff list covers.
const LOOKAHEAD_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOAD_ERROR_FALLBACK = 'Could not load the clinic schedule.';
const SAVE_ERROR_FALLBACK = 'Could not save the slot. Please try again.';
const DELETE_ERROR_FALLBACK = 'Could not delete the slot. Please try again.';
const BLOCK_ERROR_FALLBACK = 'Could not change the slot status.';

type TagSeverity = 'success' | 'warn' | 'secondary';
type SlotFilter = 'ALL' | 'open' | 'full' | 'closed' | 'expired';
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

  constructor() {
    this.reloadSlots$
      .pipe(
        switchMap(() => {
          const today = new Date();
          const end = new Date(today.getTime() + LOOKAHEAD_DAYS * MS_PER_DAY);
          return this.slotsService
            .getSlots(toDateParam(today), toDateParam(end))
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
  readonly filteredSlots = computed(() =>
    [...this.slots()]
      .sort(
        (left, right) =>
          left.clinicDate.localeCompare(right.clinicDate) ||
          left.startTime.localeCompare(right.startTime),
      )
      .filter(
        (slot) =>
          this.statusFilter() === 'ALL' ||
          getSlotStatus(slot) === this.statusFilter(),
      ),
  );
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

  // Deletes the slot and reloads; a slot with bookings returns a 409 message.
  onConfirmDelete(slot: ClinicSlot): void {
    this.deleteError.set(null);
    this.slotsService
      .deleteSlot(slot.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (): void => this.loadSlots(),
      error: (error: HttpErrorResponse): void => {
        this.deleteError.set(getErrorMessage(error, DELETE_ERROR_FALLBACK));
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

  private openForm(slot: ClinicSlot | null): void {
    this.editingSlot.set(slot);
    this.saveError.set(null);
    this.isFormOpen.set(true);
  }

  // Fetches slots from today through the lookahead window.
  loadSlots(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.reloadSlots$.next();
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

import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import {
  ClinicSlot,
  SlotFormValue,
  SlotsResponse,
  SlotStatus,
} from '@core/models';
import { SlotsService } from '@core/services';
import { getErrorMessage, getSlotStatus, toDateParam } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import { SlotFormComponent } from './slot-form/slot-form.component';

// Number of days ahead of today that the staff list covers.
const LOOKAHEAD_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOAD_ERROR_FALLBACK = 'Could not load the clinic schedule.';
const SAVE_ERROR_FALLBACK = 'Could not save the slot. Please try again.';
const DELETE_ERROR_FALLBACK = 'Could not delete the slot. Please try again.';

type TagSeverity = 'success' | 'warn' | 'secondary';

const STATUS_LABELS: Record<SlotStatus, string> = {
  open: 'Open',
  full: 'Full',
  closed: 'Closed',
};

const STATUS_SEVERITIES: Record<SlotStatus, TagSeverity> = {
  open: 'success',
  full: 'warn',
  closed: 'secondary',
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
  ],
  providers: [ConfirmationService],
  templateUrl: './staff-schedule.component.html',
  styleUrl: './staff-schedule.component.scss',
})
export class StaffScheduleComponent implements OnInit {
  private readonly slotsService: SlotsService = inject(SlotsService);
  private readonly confirmationService: ConfirmationService =
    inject(ConfirmationService);

  readonly slots = signal<ClinicSlot[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isFormOpen = signal<boolean>(false);
  readonly editingSlot = signal<ClinicSlot | null>(null);
  readonly isSaving = signal<boolean>(false);
  readonly saveError = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSlots();
  }

  onAddSlot(): void {
    this.openForm(null);
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

    request$.subscribe({
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
      message: `Delete the ${slot.clinicDate} slot at ${slot.startTime}?`,
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
    this.slotsService.deleteSlot(slot.id).subscribe({
      next: (): void => this.loadSlots(),
      error: (error: HttpErrorResponse): void => {
        this.deleteError.set(getErrorMessage(error, DELETE_ERROR_FALLBACK));
      },
    });
  }

  private openForm(slot: ClinicSlot | null): void {
    this.editingSlot.set(slot);
    this.saveError.set(null);
    this.isFormOpen.set(true);
  }

  // Fetches slots from today through the lookahead window.
  loadSlots(): void {
    const today: Date = new Date();
    const end: Date = new Date(today.getTime() + LOOKAHEAD_DAYS * MS_PER_DAY);
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.slotsService
      .getSlots(toDateParam(today), toDateParam(end))
      .subscribe({
        next: (response: SlotsResponse): void => {
          this.slots.set(response.slots);
          this.isLoading.set(false);
        },
        error: (error: HttpErrorResponse): void => {
          this.errorMessage.set(getErrorMessage(error, LOAD_ERROR_FALLBACK));
          this.isLoading.set(false);
        },
      });
  }

  statusLabel(slot: ClinicSlot): string {
    return STATUS_LABELS[getSlotStatus(slot)];
  }

  statusSeverity(slot: ClinicSlot): TagSeverity {
    return STATUS_SEVERITIES[getSlotStatus(slot)];
  }
}

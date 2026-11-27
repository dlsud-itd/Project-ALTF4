import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { BlockDayValue, ClinicSlot } from '@core/models';
import { latestScheduleDate, toDateParam } from '@core/utils';

// Start of the current day in local time.
const startOfToday = (): Date => {
  const now: Date = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Dialog for closing or reopening a whole clinic day. Blocking affects every
// slot that has not ended yet; past slots are left alone as a record.
@Component({
  selector: 'app-block-day-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    Button,
    DatePicker,
    Dialog,
    InputText,
    Message,
    ToggleSwitch,
  ],
  templateUrl: './block-day-form.component.html',
  styleUrl: './block-day-form.component.scss',
})
export class BlockDayFormComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);

  readonly isVisible = input<boolean>(false);
  readonly slots = input<readonly ClinicSlot[]>([]);
  readonly isSaving = input<boolean>(false);
  // Validation message returned by the API on save.
  readonly errorMessage = input<string | null>(null);

  readonly save = output<BlockDayValue>();
  readonly cancel = output<void>();

  // Must stay a stable object or the calendar re-renders mid-click.
  readonly minDate: Date = startOfToday();
  readonly maxDate: Date = latestScheduleDate();

  readonly form = this.fb.nonNullable.group({
    clinicDate: this.fb.nonNullable.control<Date | null>(null, [
      Validators.required,
    ]),
    isBlocked: [true],
    reason: [''],
  });

  // Slots on the picked date that have not ended, so staff see what will change.
  private readonly pickedDateSlots = computed((): readonly ClinicSlot[] => {
    const picked: Date | null = this.form.controls.clinicDate.value;
    if (!picked) {
      return [];
    }
    const pickedDate: string = toDateParam(picked);
    return this.slots().filter(
      (slot: ClinicSlot) => slot.clinicDate === pickedDate && !slot.isExpired,
    );
  });

  readonly upcomingSlotCount = computed(
    (): number => this.pickedDateSlots().length,
  );

  // Seats already held that day; each one gets a reschedule notification.
  readonly bookedCount = computed((): number =>
    this.pickedDateSlots().reduce(
      (total: number, slot: ClinicSlot) =>
        total + (slot.capacity - slot.remainingCapacity),
      0,
    ),
  );

  constructor() {
    // Reset each time the dialog opens.
    effect((): void => {
      if (!this.isVisible()) {
        return;
      }
      this.form.reset({ clinicDate: null, isBlocked: true, reason: '' });
    });
  }

  showDateError(): boolean {
    const control = this.form.controls.clinicDate;
    return control.invalid && (control.touched || control.dirty);
  }

  onSubmit(): void {
    const { clinicDate, isBlocked, reason } = this.form.getRawValue();
    if (this.form.invalid || !clinicDate) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit({
      clinicDate: toDateParam(clinicDate),
      isBlocked,
      reason: reason.trim() || undefined,
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // The dialog reports visibleChange(false) on Escape or a mask click.
  onVisibleChange(isOpen: boolean): void {
    if (!isOpen) {
      this.onCancel();
    }
  }
}

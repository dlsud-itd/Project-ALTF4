import { Component, computed, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ClinicSlot, SlotFormValue } from '@core/models';
import {
  parseDateParam,
  toDateParam,
  toTimeParam,
} from '@core/utils';

const MIN_CAPACITY = 1;
const DEFAULT_CAPACITY = 1;
const TIME_ORDER_ERROR = 'timeOrder';
const PAST_DATE_ERROR = 'pastDate';
const PAST_TIME_ERROR = 'pastTime';

// Start of the current day in local time.
const startOfToday = (): Date => {
  const now: Date = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const notInPast: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const date: Date | null = control.value;
  return date && date < startOfToday() ? { [PAST_DATE_ERROR]: true } : null;
};

type TextFieldName = 'clinicDate' | 'startTime' | 'endTime' | 'capacity';

// HH:mm strings compare correctly as text, so no Date parsing is needed.
const endAfterStart: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const start: string = group.get('startTime')?.value ?? '';
  const end: string = group.get('endTime')?.value ?? '';
  return start && end && end <= start ? { [TIME_ORDER_ERROR]: true } : null;
};

// Dialog form for adding a clinic slot or editing an existing one.
@Component({
  selector: 'app-slot-form',
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
  templateUrl: './slot-form.component.html',
  styleUrl: './slot-form.component.scss',
})
export class SlotFormComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);

  readonly isVisible = input<boolean>(false);
  // Null means a new slot; a slot means edit mode.
  readonly slot = input<ClinicSlot | null>(null);
  readonly isSaving = input<boolean>(false);
  // Validation or conflict message returned by the API on save.
  readonly errorMessage = input<string | null>(null);

  readonly save = output<SlotFormValue>();
  readonly cancel = output<void>();

  // Earliest date the date picker allows. Must stay a stable object: a new
  // Date on every change detection makes the calendar re-render mid-click.
  readonly minDate: Date = startOfToday();

  readonly isEditing = computed((): boolean => this.slot() !== null);
  readonly bookedCount = computed((): number => {
    const slot: ClinicSlot | null = this.slot();
    return slot ? slot.capacity - slot.remainingCapacity : 0;
  });
  // Date and time are locked once patients hold seats in the slot.
  readonly isScheduleLocked = computed((): boolean => this.bookedCount() > 0);
  // The API rejects a capacity below the seats already booked.
  readonly minCapacity = computed((): number =>
    Math.max(MIN_CAPACITY, this.bookedCount()),
  );

  // A new slot cannot start earlier today; existing slots are not re-checked.
  private readonly startNotPassed: ValidatorFn = (
    group: AbstractControl,
  ): ValidationErrors | null => {
    const date: Date | null = group.get('clinicDate')?.value ?? null;
    const start: string = group.get('startTime')?.value ?? '';
    const now: Date = new Date();
    const isToday: boolean = !!date && toDateParam(date) === toDateParam(now);
    return !this.isEditing() && isToday && start && start < toTimeParam(now)
      ? { [PAST_TIME_ERROR]: true }
      : null;
  };

  readonly form = this.fb.nonNullable.group(
    {
      clinicDate: this.fb.nonNullable.control<Date | null>(null, [
        Validators.required,
        notInPast,
      ]),
      startTime: ['', [Validators.required]],
      endTime: ['', [Validators.required]],
      capacity: [DEFAULT_CAPACITY, [Validators.required]],
      isBookable: [true],
    },
    { validators: [endAfterStart, this.startNotPassed] },
  );

  constructor() {
    // Reset the form each time the dialog opens or the edited slot changes.
    effect((): void => {
      if (!this.isVisible()) {
        return;
      }
      const slot: ClinicSlot | null = this.slot();
      this.form.reset({
        clinicDate: slot ? parseDateParam(slot.clinicDate) : null,
        startTime: slot?.startTime ?? '',
        endTime: slot?.endTime ?? '',
        capacity: slot?.capacity ?? DEFAULT_CAPACITY,
        isBookable: slot?.isBookable ?? true,
      });
      this.applyLockState();
    });
  }

  // Shows a field error once the user has touched or changed the control.
  showError(name: TextFieldName): boolean {
    const control: AbstractControl = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  hasPastTimeError(): boolean {
    return (
      this.form.hasError(PAST_TIME_ERROR) &&
      this.form.controls.startTime.touched
    );
  }

  hasPastDateError(): boolean {
    return this.form.controls.clinicDate.hasError(PAST_DATE_ERROR);
  }

  hasTimeOrderError(): boolean {
    const isTimeTouched: boolean =
      this.form.controls.startTime.touched ||
      this.form.controls.endTime.touched;
    return this.form.hasError(TIME_ORDER_ERROR) && isTimeTouched;
  }

  hasCapacityError(): boolean {
    const control = this.form.controls.capacity;
    const isTouched: boolean = control.touched || control.dirty;
    return isTouched && !(control.value >= this.minCapacity());
  }

  onSubmit(): void {
    const { clinicDate, ...rest } = this.form.getRawValue();
    if (this.form.invalid || this.hasCapacityError() || !clinicDate) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit({ ...rest, clinicDate: toDateParam(clinicDate) });
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

  private applyLockState(): void {
    const { clinicDate, startTime, endTime } = this.form.controls;
    for (const control of [clinicDate, startTime, endTime]) {
      if (this.isScheduleLocked()) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
  }
}

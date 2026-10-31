import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ClinicSlot, SlotFormValue } from '@core/models';
import { toTimeParam } from '@core/utils';
import { SlotFormComponent } from './slot-form.component';

// Far future so the not-in-the-past rule never fails these tests.
const FUTURE_DATE = '2099-01-01';
const FUTURE_DATE_VALUE = new Date(2099, 0, 1);

const buildSlot = (overrides: Partial<ClinicSlot> = {}): ClinicSlot => ({
  id: 1,
  clinicDate: '2026-11-12',
  startTime: '10:15',
  endTime: '10:45',
  capacity: 3,
  remainingCapacity: 3,
  isBookable: true,
  ...overrides,
});

describe('SlotFormComponent', () => {
  let fixture: ComponentFixture<SlotFormComponent>;
  let component: SlotFormComponent;

  const open = (slot: ClinicSlot | null = null): void => {
    fixture.componentRef.setInput('slot', slot);
    fixture.componentRef.setInput('isVisible', true);
    fixture.detectChanges();
  };

  const fillValid = (): void => {
    component.form.patchValue({
      clinicDate: FUTURE_DATE_VALUE,
      startTime: '09:00',
      endTime: '09:30',
      capacity: 2,
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SlotFormComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(SlotFormComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('starts empty with defaults in add mode', () => {
    open();
    expect(component.isEditing()).toBeFalse();
    expect(component.form.getRawValue()).toEqual({
      clinicDate: null,
      startTime: '',
      endTime: '',
      capacity: 1,
      isBookable: true,
    });
  });

  it('does not emit save when required fields are empty', () => {
    open();
    const spy = jasmine.createSpy('save');
    component.save.subscribe(spy);

    component.onSubmit();

    expect(spy).not.toHaveBeenCalled();
    expect(component.showError('clinicDate')).toBeTrue();
  });

  it('flags an end time that is not after the start time', () => {
    open();
    component.form.patchValue({ startTime: '10:00', endTime: '09:00' });
    component.form.controls.endTime.markAsTouched();

    expect(component.hasTimeOrderError()).toBeTrue();
  });

  it('rejects a date in the past and limits the picker to today', () => {
    open();
    fillValid();
    component.form.controls.clinicDate.setValue(new Date(2020, 0, 1));

    expect(component.hasPastDateError()).toBeTrue();
    expect(component.form.invalid).toBeTrue();
    expect(component.minDate <= new Date()).toBeTrue();
  });

  it('rejects a start time that already passed today for a new slot', () => {
    open();
    const now = new Date();
    const earlier = new Date(now.getTime() - 60 * 60 * 1000);
    fillValid();
    component.form.patchValue({
      clinicDate: now,
      startTime: toTimeParam(earlier),
      endTime: '23:59',
    });
    component.form.controls.startTime.markAsTouched();

    // Only meaningful when the hour before is still today.
    if (earlier.getDate() === now.getDate()) {
      expect(component.hasPastTimeError()).toBeTrue();
    }
  });

  it('shows the API error message passed in by the page', () => {
    fixture.componentRef.setInput('errorMessage', 'Capacity is too low');
    open();

    const element = fixture.nativeElement as HTMLElement;
    expect(document.body.textContent).toContain('Capacity is too low');
    expect(element).toBeTruthy();
  });

  it('emits the form value when valid', () => {
    open();
    const spy = jasmine.createSpy('save');
    component.save.subscribe(spy);
    fillValid();

    component.onSubmit();

    expect(spy).toHaveBeenCalledOnceWith({
      clinicDate: FUTURE_DATE,
      startTime: '09:00',
      endTime: '09:30',
      capacity: 2,
      isBookable: true,
    } as SlotFormValue);
  });

  it('prefills the slot values in edit mode', () => {
    open(buildSlot({ capacity: 4, remainingCapacity: 4, isBookable: false }));

    expect(component.isEditing()).toBeTrue();
    expect(component.form.getRawValue().startTime).toBe('10:15');
    expect(component.form.getRawValue().capacity).toBe(4);
    expect(component.form.getRawValue().isBookable).toBeFalse();
  });

  it('keeps date and time editable when nobody has booked', () => {
    open(buildSlot());
    expect(component.isScheduleLocked()).toBeFalse();
    expect(component.form.controls.startTime.enabled).toBeTrue();
  });

  it('locks date and time and floors capacity when seats are booked', () => {
    open(buildSlot({ capacity: 4, remainingCapacity: 1 }));

    expect(component.isScheduleLocked()).toBeTrue();
    expect(component.form.controls.clinicDate.disabled).toBeTrue();
    expect(component.form.controls.startTime.disabled).toBeTrue();
    expect(component.minCapacity()).toBe(3);

    const spy = jasmine.createSpy('save');
    component.save.subscribe(spy);
    component.form.controls.capacity.setValue(2);
    component.form.controls.capacity.markAsDirty();
    component.onSubmit();

    expect(component.hasCapacityError()).toBeTrue();
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits cancel when the dialog is dismissed', () => {
    open();
    const spy = jasmine.createSpy('cancel');
    component.cancel.subscribe(spy);

    component.onVisibleChange(false);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

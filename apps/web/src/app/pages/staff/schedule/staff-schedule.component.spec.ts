import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ConfirmationService } from 'primeng/api';
import { ClinicSlot, SlotFormValue } from '@core/models';
import { StaffScheduleComponent } from './staff-schedule.component';

const SLOTS_URL_PATTERN = /\/slots\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/;

const buildSlot = (overrides: Partial<ClinicSlot> = {}): ClinicSlot => ({
  id: 1,
  clinicDate: '2026-11-12',
  startTime: '10:15',
  endTime: '10:45',
  capacity: 3,
  remainingCapacity: 2,
  isBookable: true,
  ...overrides,
});

describe('StaffScheduleComponent', () => {
  let fixture: ComponentFixture<StaffScheduleComponent>;
  let component: StaffScheduleComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffScheduleComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffScheduleComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  const flushSlots = (slots: ClinicSlot[]): void => {
    http.expectOne((req) => SLOTS_URL_PATTERN.test(req.urlWithParams)).flush({
      slots,
    });
    fixture.detectChanges();
  };

  it('shows a loading skeleton while slots load', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-loading-skeleton')).toBeTruthy();
    flushSlots([]);
  });

  it('renders a row with capacity, remaining and status per slot', () => {
    flushSlots([
      buildSlot(),
      buildSlot({ id: 2, remainingCapacity: 0, isBookable: false }),
      buildSlot({ id: 3, isBookable: false }),
    ]);
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('tbody tr');

    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('10:15 - 10:45');
    expect(rows[0].textContent).toContain('Open');
    expect(rows[1].textContent).toContain('Full');
    expect(rows[2].textContent).toContain('Closed');
  });

  it('opens the form in add mode and in edit mode for a row', () => {
    flushSlots([buildSlot()]);

    component.onAddSlot();
    expect(component.isFormOpen()).toBeTrue();
    expect(component.editingSlot()).toBeNull();

    component.onFormCancel();
    expect(component.isFormOpen()).toBeFalse();

    component.onEditSlot(component.slots()[0]);
    expect(component.isFormOpen()).toBeTrue();
    expect(component.editingSlot()?.id).toBe(1);
  });

  const formValue: SlotFormValue = {
    clinicDate: '2099-01-01',
    startTime: '09:00',
    endTime: '09:30',
    capacity: 2,
    isBookable: true,
  };

  it('creates a slot, closes the form and reloads the list', () => {
    flushSlots([]);
    component.onAddSlot();

    component.onFormSave(formValue);
    const req = http.expectOne((r) => r.url.endsWith('/slots'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(formValue);
    req.flush({ message: 'Slot created successfully', id: 5 });

    expect(component.isFormOpen()).toBeFalse();
    flushSlots([buildSlot({ id: 5 })]);
    expect(component.slots().length).toBe(1);
  });

  it('updates the edited slot with PATCH', () => {
    flushSlots([buildSlot()]);
    component.onEditSlot(component.slots()[0]);

    component.onFormSave(formValue);
    const req = http.expectOne((r) => r.url.endsWith('/slots/1'));
    expect(req.request.method).toBe('PATCH');
    req.flush({ message: 'Slot updated successfully' });

    flushSlots([buildSlot()]);
    expect(component.isFormOpen()).toBeFalse();
  });

  it('keeps the form open and shows the API conflict message', () => {
    flushSlots([buildSlot()]);
    component.onEditSlot(component.slots()[0]);

    component.onFormSave(formValue);
    http
      .expectOne((r) => r.url.endsWith('/slots/1'))
      .flush(
        { message: 'Capacity cannot be lower than booked appointments' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.isFormOpen()).toBeTrue();
    expect(component.isSaving()).toBeFalse();
    expect(component.saveError()).toBe(
      'Capacity cannot be lower than booked appointments',
    );
  });

  it('deletes a slot and reloads the list', () => {
    flushSlots([buildSlot()]);

    component.onConfirmDelete(component.slots()[0]);
    const req = http.expectOne((r) => r.url.endsWith('/slots/1'));
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Slot deleted successfully' });

    flushSlots([]);
    expect(component.slots().length).toBe(0);
    expect(component.deleteError()).toBeNull();
  });

  it('shows the API message when the slot has active bookings', () => {
    flushSlots([buildSlot()]);

    component.onConfirmDelete(component.slots()[0]);
    http.expectOne((r) => r.url.endsWith('/slots/1')).flush(
      { message: 'Slot has active appointments. Set isBookable to false instead' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(component.deleteError()).toContain('active appointments');
    expect(component.slots().length).toBe(1);
  });

  it('asks for confirmation before deleting', () => {
    flushSlots([buildSlot()]);
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    const spy = spyOn(confirmation, 'confirm');

    component.onDeleteSlot(component.slots()[0]);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there are no slots', () => {
    flushSlots([]);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-empty-state')).toBeTruthy();
  });

  it('shows the error state and reloads on retry', () => {
    http
      .expectOne((req) => SLOTS_URL_PATTERN.test(req.urlWithParams))
      .flush({ message: 'Boom' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-error-state')).toBeTruthy();

    component.loadSlots();
    flushSlots([buildSlot()]);
    expect(element.querySelector('app-error-state')).toBeNull();
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });
});

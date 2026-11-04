import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QueueStatus } from '@core/models';
import { PatientQueueComponent } from './queue.component';

describe('PatientQueueComponent', () => {
  let component: PatientQueueComponent;
  let fixture: ComponentFixture<PatientQueueComponent>;

  const getElement = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientQueueComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientQueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the header band title', () => {
    expect(getElement().querySelector('.page-top h2')?.textContent).toContain(
      'Your Queue',
    );
  });

  it('should show ticket number, position, wait and status', () => {
    const text = getElement().textContent ?? '';
    const { ticketNumber, positionInQueue, estimatedWaitMinutes } =
      component.entry();

    expect(text).toContain(ticketNumber);
    expect(
      getElement().querySelector('.position-value')?.textContent,
    ).toContain(String(positionInQueue));
    expect(getElement().querySelector('.wait-value')?.textContent).toContain(
      String(estimatedWaitMinutes),
    );
    expect(getElement().querySelector('.entry-status')?.textContent).toContain(
      'Waiting',
    );
  });

  it('should compute people ahead from the position', () => {
    component.entry.update((entry) => ({ ...entry, positionInQueue: 1 }));
    expect(component.peopleAhead()).toBe(0);

    component.entry.update((entry) => ({ ...entry, positionInQueue: 4 }));
    expect(component.peopleAhead()).toBe(3);
  });

  it('should show now serving, waiting count and last updated', () => {
    const text = getElement().textContent ?? '';
    const { nowServing, patientsWaiting, lastUpdated } = component.summary();

    expect(text).toContain(nowServing);
    expect(text).toContain(String(patientsWaiting));
    expect(text).toContain(lastUpdated);
  });

  it('should render four tracker steps with one current step', () => {
    const element = getElement();

    expect(element.querySelectorAll('.tracker-step').length).toBe(4);
    expect(element.querySelectorAll('.tracker-step.current').length).toBe(1);
    expect(element.querySelectorAll('.tracker-step.done').length).toBe(0);
  });

  it('should mark every step done once the ticket is served', () => {
    component.entry.update((entry) => ({
      ...entry,
      status: QueueStatus.SERVED,
    }));
    fixture.detectChanges();

    const element = getElement();
    expect(element.querySelectorAll('.tracker-step.done').length).toBe(4);
    expect(element.querySelectorAll('.tracker-step.current').length).toBe(0);
  });

  it('should hide the tracker for cancelled and no-show tickets', () => {
    for (const status of [QueueStatus.CANCELLED, QueueStatus.NO_SHOW]) {
      component.entry.update((entry) => ({ ...entry, status }));
      fixture.detectChanges();

      const element = getElement();
      expect(element.querySelector('.tracker')).toBeNull();
      expect(element.querySelector('.terminal-note')).toBeTruthy();
    }
  });
});

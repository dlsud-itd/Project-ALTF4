import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PatientDashboardComponent } from './patient-dashboard.component';

describe('PatientDashboardComponent', () => {
  let component: PatientDashboardComponent;
  let fixture: ComponentFixture<PatientDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientDashboardComponent],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render navigation for appointments, schedules and queue operations', () => {
    const items = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.dashboard-nav .nav-item'),
    ).map((item) => item.textContent?.trim());

    expect(items).toEqual(['Queue Operations', 'Schedules', 'Appointments']);
  });

  it('should mark the queue operations section active by default', () => {
    expect(component.activeSection()).toBe('queue-operations');
    const active = (fixture.nativeElement as HTMLElement).querySelector('.nav-item.active');
    expect(active?.textContent).toContain('Queue Operations');
  });

  it('should update the active section when navigating', () => {
    component.scrollToSection('appointments');
    fixture.detectChanges();

    expect(component.activeSection()).toBe('appointments');
    const active = (fixture.nativeElement as HTMLElement).querySelector('.nav-item.active');
    expect(active?.textContent).toContain('Appointments');
  });
});

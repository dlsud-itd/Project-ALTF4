import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { StaffDashboardComponent } from './staff-dashboard.component';

describe('StaffDashboardComponent', () => {
  let component: StaffDashboardComponent;
  let fixture: ComponentFixture<StaffDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffDashboardComponent],
      providers: [provideRouter([]), provideHttpClient()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaffDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fall back to placeholder profile details when unauthenticated', () => {
    expect(component.staffName()).toBe('Staff Nurse');
    expect(component.staffEmail()).toBe('staff@dlsud.edu.ph');
    expect(component.staffRole()).toBe('STAFF');
  });

  it('should render the profile summary and upcoming events placeholder', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.profile-card')).toBeTruthy();
    expect(element.querySelector('#profile-title')?.textContent).toContain('Staff Nurse');
    expect(element.querySelector('.placeholder-panel #events-title')?.textContent).toContain('Upcoming Events');
  });
});

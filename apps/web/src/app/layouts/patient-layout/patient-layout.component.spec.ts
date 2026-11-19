import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PatientLayoutComponent } from './patient-layout.component';

describe('PatientLayoutComponent', () => {
  let component: PatientLayoutComponent;
  let fixture: ComponentFixture<PatientLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientLayoutComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render sidebar navigation links in order', () => {
    const element = fixture.nativeElement as HTMLElement;
    const navItems = Array.from(
      element.querySelectorAll('.sidebar-nav .nav-label'),
    ).map((item) => item.textContent?.trim());

    expect(navItems).toEqual([
      'Dashboard',
      'Bookings',
      'Queue',
      'Notifications',
      'Profile',
    ]);
  });

  it('should show the sample unread badge and hide it at zero', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.nav-badge')?.textContent?.trim()).toBe('3');

    component.unreadCount.set(0);
    fixture.detectChanges();
    expect(element.querySelector('.unread-badge')).toBeNull();
  });

  it('should display brand title in the sidebar', () => {
    const brandTitle = (fixture.nativeElement as HTMLElement).querySelector('.brand-name');
    expect(brandTitle?.textContent).toContain('ClinicQueue');
  });

  it('should toggle and close mobile menu', () => {
    expect(component.isMobileMenuOpen()).toBeFalse();

    component.toggleMobileMenu();
    expect(component.isMobileMenuOpen()).toBeTrue();

    component.closeMobileMenu();
    expect(component.isMobileMenuOpen()).toBeFalse();
  });
});

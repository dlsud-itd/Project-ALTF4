import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { StaffLayoutComponent } from './staff-layout.component';

describe('StaffLayoutComponent', () => {
  let component: StaffLayoutComponent;
  let fixture: ComponentFixture<StaffLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffLayoutComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render sidebar navigation links for Dashboard, Schedule and Profile', () => {
    const navItems = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.sidebar-nav .nav-link'),
    ).map((item) => item.textContent?.trim());

    expect(navItems).toEqual(['Dashboard', 'Schedule', 'Profile']);
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

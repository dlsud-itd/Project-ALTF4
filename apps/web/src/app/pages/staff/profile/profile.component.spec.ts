import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { StaffProfileComponent } from './profile.component';

describe('StaffProfileComponent', () => {
  let component: StaffProfileComponent;
  let fixture: ComponentFixture<StaffProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffProfileComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(StaffProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the staff profile card with metadata', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.profile-card')).toBeTruthy();
    expect(element.querySelector('.meta-grid')).toBeTruthy();
  });
});


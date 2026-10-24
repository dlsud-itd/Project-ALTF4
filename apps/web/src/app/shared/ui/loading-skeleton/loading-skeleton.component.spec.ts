import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingSkeletonComponent } from './loading-skeleton.component';

describe('LoadingSkeletonComponent', () => {
  let component: LoadingSkeletonComponent;
  let fixture: ComponentFixture<LoadingSkeletonComponent>;

  const countSkeletons = (): number =>
    fixture.nativeElement.querySelectorAll('p-skeleton').length;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingSkeletonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingSkeletonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show 3 skeleton lines by default', () => {
    expect(countSkeletons()).toBe(3);
  });

  it('should show as many lines as requested', () => {
    fixture.componentRef.setInput('lines', 5);
    fixture.detectChanges();

    expect(countSkeletons()).toBe(5);
  });

  it('should tell assistive tech that content is loading', () => {
    const list: HTMLElement = fixture.nativeElement.querySelector('div');

    expect(list.getAttribute('role')).toBe('status');
  });
});
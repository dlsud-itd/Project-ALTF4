import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  let component: ErrorStateComponent;
  let fixture: ComponentFixture<ErrorStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the default title and message', () => {
    const text: string = fixture.nativeElement.textContent;

    expect(text).toContain('Something went wrong');
    expect(text).toContain('Please try again in a moment.');
  });

  it('should show a custom message', () => {
    fixture.componentRef.setInput('message', 'Could not load the queue.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Could not load the queue.',
    );
  });

  it('should emit retry when the button is clicked', () => {
    const retrySpy = jasmine.createSpy('retry');
    component.retry.subscribe(retrySpy);

    fixture.nativeElement.querySelector('button').click();

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
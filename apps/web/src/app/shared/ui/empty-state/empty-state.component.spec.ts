import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'No upcoming appointments');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the title', () => {
    const title: HTMLElement = fixture.nativeElement.querySelector('h3');

    expect(title.textContent).toContain('No upcoming appointments');
  });

  it('should hide the message when none is given', () => {
    expect(fixture.nativeElement.querySelector('.state-message')).toBeNull();
  });

  it('should show the message when one is given', () => {
    fixture.componentRef.setInput('message', 'Book a visit to see it here.');
    fixture.detectChanges();

    const message: HTMLElement =
      fixture.nativeElement.querySelector('.state-message');

    expect(message.textContent).toContain('Book a visit');
  });

  it('should use the icon input as a class', () => {
    fixture.componentRef.setInput('icon', 'pi-calendar');
    fixture.detectChanges();

    const icon: HTMLElement =
      fixture.nativeElement.querySelector('.state-icon');

    expect(icon.classList.contains('pi-calendar')).toBeTrue();
  });
});
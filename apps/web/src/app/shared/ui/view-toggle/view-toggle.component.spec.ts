import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewToggleComponent } from './view-toggle.component';

describe('ViewToggleComponent', () => {
  let component: ViewToggleComponent;
  let fixture: ComponentFixture<ViewToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewToggleComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('view', 'table');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to table view', () => {
    expect(component.view()).toBe('table');
  });

  it('should switch view and emit viewChange event when card is selected', () => {
    let emittedMode: string | null = null;
    component.viewChange.subscribe((mode) => {
      emittedMode = mode;
    });

    component.selectView('card');
    fixture.detectChanges();

    expect(component.view()).toBe('card');
    expect(emittedMode as string | null).toBe('card');
  });
});

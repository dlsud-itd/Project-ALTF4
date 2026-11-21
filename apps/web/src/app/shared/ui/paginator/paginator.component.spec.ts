import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginatorComponent } from './paginator.component';

describe('PaginatorComponent', () => {
  let component: PaginatorComponent;
  let fixture: ComponentFixture<PaginatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginatorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('totalRecords', 55);
    fixture.componentRef.setInput('rows', 10);
    fixture.componentRef.setInput('first', 0);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute totalPages correctly', () => {
    expect(component.totalPages()).toBe(6);
  });

  it('should compute start and end records correctly on page 1', () => {
    expect(component.startRecord()).toBe(1);
    expect(component.endRecord()).toBe(10);
    expect(component.currentPage()).toBe(1);
  });

  it('should navigate to next page and emit pageChange event', () => {
    let emittedEvent: unknown = null;
    component.pageChange.subscribe((event) => {
      emittedEvent = event;
    });

    component.nextPage();
    fixture.detectChanges();

    expect(component.currentPage()).toBe(2);
    expect(component.startRecord()).toBe(11);
    expect(component.endRecord()).toBe(20);
    expect(emittedEvent).toEqual({ page: 2, first: 10, rows: 10 });
  });

  it('should handle rows per page change and reset to page 1', () => {
    let emittedEvent: unknown = null;
    component.pageChange.subscribe((event) => {
      emittedEvent = event;
    });

    component.onRowsChange(25);
    fixture.detectChanges();

    expect(component.rows()).toBe(25);
    expect(component.first()).toBe(0);
    expect(component.totalPages()).toBe(3);
    expect(emittedEvent).toEqual({ page: 1, first: 0, rows: 25 });
  });
});

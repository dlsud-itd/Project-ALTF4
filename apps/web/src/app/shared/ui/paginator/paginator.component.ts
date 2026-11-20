import {
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PageChangeEvent {
  page: number;
  first: number;
  rows: number;
}

@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
})
export class PaginatorComponent {
  readonly totalRecords = input<number>(0);
  readonly rows = model<number>(10);
  readonly first = model<number>(0);
  readonly rowsPerPageOptions = input<number[]>([10, 25, 50]);
  readonly showReport = input<boolean>(true);

  readonly pageChange = output<PageChangeEvent>();

  readonly totalPages = computed<number>(() => {
    const total = this.totalRecords();
    const size = this.rows();
    return Math.max(1, Math.ceil(total / size));
  });

  readonly currentPage = computed<number>(() => {
    return Math.floor(this.first() / this.rows()) + 1;
  });

  readonly startRecord = computed<number>(() => {
    if (this.totalRecords() === 0) return 0;
    return this.first() + 1;
  });

  readonly endRecord = computed<number>(() => {
    return Math.min(this.first() + this.rows(), this.totalRecords());
  });

  readonly isFirstPage = computed<boolean>(() => this.currentPage() <= 1);
  readonly isLastPage = computed<boolean>(() => this.currentPage() >= this.totalPages());

  readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const pages: number[] = [];

    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  goToPage(pageNumber: number): void {
    if (pageNumber < 1 || pageNumber > this.totalPages() || pageNumber === this.currentPage()) {
      return;
    }
    const newFirst = (pageNumber - 1) * this.rows();
    this.first.set(newFirst);
    this.pageChange.emit({
      page: pageNumber,
      first: newFirst,
      rows: this.rows(),
    });
  }

  prevPage(): void {
    if (!this.isFirstPage()) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (!this.isLastPage()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  firstPage(): void {
    if (!this.isFirstPage()) {
      this.goToPage(1);
    }
  }

  lastPage(): void {
    if (!this.isLastPage()) {
      this.goToPage(this.totalPages());
    }
  }

  onRowsChange(value: string | number): void {
    const newRows = Number(value);
    this.rows.set(newRows);
    this.first.set(0);
    this.pageChange.emit({
      page: 1,
      first: 0,
      rows: newRows,
    });
  }
}

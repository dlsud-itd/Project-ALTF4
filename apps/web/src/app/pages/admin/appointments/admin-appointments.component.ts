import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { AdminService } from '@core/services';
import { AdminAppointment, AppointmentStatus } from '@core/models';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
  PaginatorComponent,
  ViewToggleComponent,
  DataViewMode,
} from '@shared/ui';
import { getErrorMessage } from '@core/utils';

type AppointmentStatusFilter = 'ALL' | 'BOOKED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-admin-appointments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePicker,
    InputText,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
    PaginatorComponent,
    ViewToggleComponent,
  ],
  templateUrl: './admin-appointments.component.html',
  styleUrl: './admin-appointments.component.scss',
})
export class AdminAppointmentsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly appointments = signal<AdminAppointment[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Filters & layout
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<AppointmentStatusFilter>('ALL');
  readonly dateFilter = signal<string>('');
  readonly viewMode = signal<DataViewMode>('table');

  // Pagination
  readonly first = signal<number>(0);
  readonly rows = signal<number>(10);

  readonly filteredAppointments = computed<AdminAppointment[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const date = this.dateFilter();
    let list = this.appointments();

    if (status !== 'ALL') {
      list = list.filter((a) => a.status === status);
    }

    if (date) {
      list = list.filter((a) => a.slot.clinicDate === date);
    }

    if (query) {
      list = list.filter(
        (a) =>
          a.patient.fullName.toLowerCase().includes(query) ||
          a.patient.email.toLowerCase().includes(query) ||
          (a.ticketNumber && a.ticketNumber.toLowerCase().includes(query)),
      );
    }

    return list;
  });

  readonly pagedAppointments = computed<AdminAppointment[]>(() => {
    const list = this.filteredAppointments();
    const offset = this.first();
    const size = this.rows();
    return list.slice(offset, offset + size);
  });

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.adminService.getAppointments().subscribe({
      next: (res) => {
        this.appointments.set(res.appointments);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(
          getErrorMessage(err, 'Failed to retrieve clinic appointments registry'),
        );
        this.isLoading.set(false);
      },
    });
  }

  setStatusFilter(filter: AppointmentStatusFilter): void {
    this.statusFilter.set(filter);
    this.first.set(0);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.first.set(0);
  }

  // Date picker works with Date objects; the filter stores a local YYYY-MM-DD string.
  readonly dateFilterValue = computed<Date | null>(() => {
    const value = this.dateFilter();
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  });

  onDatePicked(value: Date | null | undefined): void {
    if (!value) {
      this.onDateFilterChange('');
      return;
    }
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    this.onDateFilterChange(`${value.getFullYear()}-${month}-${day}`);
  }

  onDateFilterChange(val: string): void {
    this.dateFilter.set(val);
    this.first.set(0);
  }

  statusSeverity(status: AppointmentStatus): TagSeverity {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'BOOKED':
        return 'info';
      case 'NO_SHOW':
        return 'danger';
      case 'CANCELLED':
      default:
        return 'secondary';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

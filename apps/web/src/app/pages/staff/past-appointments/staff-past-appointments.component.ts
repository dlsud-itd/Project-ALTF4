import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { InputText } from 'primeng/inputtext';
import { AppointmentsService } from '@core/services';
import { AppointmentStatus, StaffAppointment } from '@core/models';
import { getErrorMessage } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

type PastStatusFilter = 'ALL' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

const STATUS_SEVERITIES: Record<AppointmentStatus, TagSeverity> = {
  BOOKED: 'info',
  CANCELLED: 'secondary',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
};

function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minute = String(m).padStart(2, '0');
  return `${String(hour12).padStart(2, '0')}:${minute} ${suffix}`;
}

function formatTimeRange(start: string, end: string): string {
  if (!start) return '';
  const formattedStart = formatTime12h(start);
  if (!end) return formattedStart;
  const formattedEnd = formatTime12h(end);
  return `${formattedStart} - ${formattedEnd}`;
}

@Component({
  selector: 'app-staff-past-appointments',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    Button,
    Tag,
    InputText,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './staff-past-appointments.component.html',
  styleUrl: './staff-past-appointments.component.scss',
})
export class StaffPastAppointmentsComponent implements OnInit {
  private readonly appointmentsService = inject(AppointmentsService);

  readonly appointments = signal<StaffAppointment[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<PastStatusFilter>('ALL');

  readonly todayStr = computed(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  readonly pastAppointments = computed(() => {
    const today = this.todayStr();
    return this.appointments().filter(
      (a) => a.status !== 'BOOKED' || a.slot.clinicDate < today,
    );
  });

  readonly filteredAppointments = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.statusFilter();
    let list = this.pastAppointments();

    if (filter !== 'ALL') {
      list = list.filter((a) => a.status === filter);
    }

    if (query) {
      list = list.filter(
        (a) =>
          a.patient.fullName.toLowerCase().includes(query) ||
          a.slot.clinicDate.includes(query),
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.appointmentsService.getAppointments().subscribe({
      next: (response) => {
        const sorted = (response.appointments ?? []).sort((a, b) => {
          return (
            b.slot.clinicDate.localeCompare(a.slot.clinicDate) ||
            b.slot.startTime.localeCompare(a.slot.startTime)
          );
        });
        this.appointments.set(sorted);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          getErrorMessage(err, 'Failed to load past appointments. Please try again.'),
        );
        this.isLoading.set(false);
      },
    });
  }

  setStatusFilter(filter: PastStatusFilter): void {
    this.statusFilter.set(filter);
  }

  formatClinicDate(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatTimeRange(startTime: string, endTime: string): string {
    return formatTimeRange(startTime, endTime);
  }

  statusLabel(status: AppointmentStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusSeverity(status: AppointmentStatus): TagSeverity {
    return STATUS_SEVERITIES[status] ?? 'secondary';
  }
}

import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { AppointmentsService, PatientAppointmentsStore } from '@core/services';
import { PatientAppointment, AppointmentStatus } from '@core/models';
import { getErrorMessage } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

export type HistoryFilterTab = 'ALL' | 'UPCOMING' | 'PAST';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No Show',
};

const STATUS_SEVERITIES: Record<AppointmentStatus, TagSeverity> = {
  BOOKED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'info',
  NO_SHOW: 'secondary',
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
  selector: 'app-patient-bookings-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Button,
    Tag,
    Message,
    ConfirmDialog,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './patient-bookings-history.component.html',
  styleUrl: './patient-bookings-history.component.scss',
})
export class PatientBookingsHistoryComponent implements OnInit {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly appointmentsStore = inject(PatientAppointmentsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationService = inject(ConfirmationService);

  readonly appointments = this.appointmentsStore.appointments;
  readonly isLoading = this.appointmentsStore.isLoading;
  readonly error = this.appointmentsStore.error;
  readonly activeFilter = signal<HistoryFilterTab>('ALL');
  readonly cancellingId = signal<number | null>(null);
  readonly archivingId = signal<number | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly todayStr = computed(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  readonly upcomingAppointments = computed(() => {
    return this.appointments().filter((appointment) =>
      this.isUpcoming(appointment),
    );
  });

  readonly pastAppointments = computed(() => {
    return this.appointments().filter(
      (appointment) => !this.isUpcoming(appointment),
    );
  });

  readonly filteredAppointments = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'UPCOMING') {
      return this.upcomingAppointments();
    }
    if (filter === 'PAST') {
      return this.pastAppointments();
    }
    return this.appointments();
  });

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.appointmentsStore.load();
  }

  setFilter(filter: HistoryFilterTab): void {
    this.activeFilter.set(filter);
  }

  isUpcoming(appt: PatientAppointment): boolean {
    return appt.status === 'BOOKED' && !appt.slot.isExpired;
  }

  canArchive(appt: PatientAppointment): boolean {
    return (
      appt.slot.isExpired === true &&
      (appt.status === 'COMPLETED' || appt.status === 'CANCELLED')
    );
  }

  getDayOfWeek(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }

  getDayNumber(dateStr: string): string {
    if (!dateStr) return '';
    const [, , day] = dateStr.split('-');
    return String(Number(day));
  }

  getMonthName(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short' });
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

  onCancelAppointment(appointment: PatientAppointment): void {
    this.confirmationService.confirm({
      header: 'Cancel Appointment',
      message: `Are you sure you want to cancel your consultation scheduled for ${this.formatClinicDate(appointment.slot.clinicDate)} at ${this.formatTimeRange(appointment.slot.startTime, appointment.slot.endTime)}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes, Cancel',
      rejectLabel: 'Keep Appointment',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => {
        this.cancellingId.set(appointment.id);
        this.actionError.set(null);
        this.actionSuccess.set(null);

        this.appointmentsService
          .cancelAppointment(appointment.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
          next: (): void => {
            this.cancellingId.set(null);
            this.actionSuccess.set('Appointment cancelled successfully.');
            this.appointmentsStore.load();
          },
          error: (err: HttpErrorResponse): void => {
            this.cancellingId.set(null);
            this.actionError.set(
              getErrorMessage(err, 'Could not cancel the appointment. Please try again.'),
            );
          },
          });
      },
    });
  }

  onArchiveAppointment(appointment: PatientAppointment): void {
    if (!this.canArchive(appointment)) {
      return;
    }

    this.confirmationService.confirm({
      header: 'Archive Booking',
      message: `Archive the ${this.formatClinicDate(appointment.slot.clinicDate)} appointment? It will be hidden from this list.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Archive',
      rejectLabel: 'Keep Booking',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => {
        this.archivingId.set(appointment.id);
        this.actionError.set(null);
        this.actionSuccess.set(null);
        this.appointmentsService
          .archiveAppointment(appointment.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
          next: (): void => {
            this.archivingId.set(null);
            this.actionSuccess.set('Booking archived successfully.');
            this.appointmentsStore.load();
          },
          error: (error: HttpErrorResponse): void => {
            this.archivingId.set(null);
            this.actionError.set(
              getErrorMessage(error, 'Could not archive this booking.'),
            );
          },
          });
      },
    });
  }
}

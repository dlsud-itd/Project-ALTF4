import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { AuthService, AppointmentsService } from '@core/services';
import { PatientAppointment, AppointmentStatus } from '@core/models';
import { getErrorMessage } from '@core/utils';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

type TagSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

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

// Patient portal dashboard presenting ticket status, clinic schedules, and active appointments.
@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    Button,
    ConfirmDialog,
    Message,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
})
export class PatientDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly patientName = computed(
    (): string => this.authService.currentUser()?.fullName ?? 'Patient',
  );
  readonly currentTicket = signal<string | null>(null);
  readonly nowServingTicket = signal<string>('A-104');

  // Queue state
  readonly isQueueLoading = signal<boolean>(false);
  readonly hasQueueError = signal<boolean>(false);

  // Appointments state
  readonly appointments = signal<PatientAppointment[]>([]);
  readonly isAppointmentsLoading = signal<boolean>(false);
  readonly appointmentsError = signal<string | null>(null);
  readonly cancellingId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);

  // Computed subsets
  readonly upcomingAppointments = computed((): PatientAppointment[] => {
    return this.appointments().filter(
      (a: PatientAppointment): boolean => a.status === 'BOOKED',
    );
  });

  readonly pastAppointments = computed((): PatientAppointment[] => {
    return this.appointments().filter(
      (a: PatientAppointment): boolean => a.status !== 'BOOKED',
    );
  });

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.isAppointmentsLoading.set(true);
    this.appointmentsError.set(null);

    this.appointmentsService.getMyAppointments().subscribe({
      next: (res): void => {
        this.appointments.set(res.appointments);
        this.isAppointmentsLoading.set(false);
      },
      error: (err: HttpErrorResponse): void => {
        this.appointmentsError.set(
          getErrorMessage(err, 'Could not load your appointments.'),
        );
        this.isAppointmentsLoading.set(false);
      },
    });
  }

  onCancelAppointment(appointment: PatientAppointment): void {
    this.confirmationService.confirm({
      header: 'Cancel Appointment',
      message: `Are you sure you want to cancel your consultation on ${this.formatClinicDate(appointment.slot.clinicDate)} at ${appointment.slot.startTime}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes, Cancel',
      rejectLabel: 'Keep Appointment',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: (): void => {
        this.cancellingId.set(appointment.id);
        this.actionError.set(null);
        this.actionSuccess.set(null);

        this.appointmentsService.cancelAppointment(appointment.id).subscribe({
          next: (): void => {
            this.cancellingId.set(null);
            this.actionSuccess.set('Appointment cancelled successfully.');
            this.loadAppointments();
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

  statusLabel(status: AppointmentStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusSeverity(status: AppointmentStatus): TagSeverity {
    return STATUS_SEVERITIES[status] ?? 'secondary';
  }

  onJoinQueue(): void {
    this.currentTicket.set('A-108');
  }

  onLeaveQueue(): void {
    this.currentTicket.set(null);
  }

  onRetryQueue(): void {
    this.hasQueueError.set(false);
  }
}

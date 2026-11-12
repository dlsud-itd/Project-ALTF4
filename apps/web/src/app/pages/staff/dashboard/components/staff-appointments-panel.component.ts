import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import { Tag } from 'primeng/tag';
import {
  AppointmentTagSeverity,
  StaffAppointmentRow,
  appointmentStatusLabel,
  appointmentStatusSeverity,
  appointmentTimeRange,
  dateDisplayFormat,
} from '../data/staff-dashboard.data';

@Component({
  selector: 'app-staff-appointments-panel',
  standalone: true,
  imports: [
    DatePipe,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
    Tag,
  ],
  templateUrl: './staff-appointments-panel.component.html',
  styleUrl: './staff-appointments-panel.component.scss',
})
export class StaffAppointmentsPanelComponent {
  readonly appointments = input.required<StaffAppointmentRow[]>();
  readonly isAppointmentsLoading = input.required<boolean>();
  readonly hasAppointmentsError = input.required<boolean>();
  readonly hasAppointments = input.required<boolean>();
  readonly retryAppointments = output<void>();

  protected readonly dateFormat = dateDisplayFormat;
  protected readonly appointmentStatusLabel = appointmentStatusLabel;
  protected readonly appointmentStatusSeverity = (
    status: StaffAppointmentRow['status'],
  ): AppointmentTagSeverity => appointmentStatusSeverity(status);
  protected readonly appointmentTimeRange = appointmentTimeRange;

  onRetryAppointments(): void {
    this.retryAppointments.emit();
  }
}

import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
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

export interface ClinicDatePill {
  dateKey: string;
  dayOfWeek: string;
  dayNumber: string;
  month: string;
  displayDate: string;
  fullLabel: string;
  isToday: boolean;
  count: number;
}

export type StaffAppointmentsTab = 'UPCOMING' | 'PAST';

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
  readonly pastAppointments = input<StaffAppointmentRow[]>([]);
  readonly isAppointmentsLoading = input.required<boolean>();
  readonly hasAppointmentsError = input.required<boolean>();
  readonly hasAppointments = input.required<boolean>();
  readonly retryAppointments = output<void>();

  readonly activeTab = signal<StaffAppointmentsTab>('UPCOMING');
  readonly selectedDate = signal<string | null>(null);

  protected readonly dateFormat = dateDisplayFormat;
  protected readonly appointmentStatusLabel = appointmentStatusLabel;
  protected readonly appointmentStatusSeverity = (
    status: StaffAppointmentRow['status'],
  ): AppointmentTagSeverity => appointmentStatusSeverity(status);
  protected readonly appointmentTimeRange = appointmentTimeRange;

  readonly datePills = computed((): ClinicDatePill[] => {
    const list = this.appointments();
    if (!list || list.length === 0) {
      return [];
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const dateCounts = new Map<string, number>();
    for (const appt of list) {
      const key = appt.clinicDate.split('T')[0];
      dateCounts.set(key, (dateCounts.get(key) || 0) + 1);
    }

    const sortedDateKeys = Array.from(dateCounts.keys()).sort();

    return sortedDateKeys.map((dateKey) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d
        .toLocaleDateString('en-US', { weekday: 'short' })
        .toUpperCase();
      const dayNumber = String(Number(day));
      const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
      const fullLabel = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const isToday = dateKey === todayStr;

      return {
        dateKey,
        dayOfWeek,
        dayNumber,
        month: monthStr,
        displayDate: `${monthStr} ${dayNumber}`,
        fullLabel,
        isToday,
        count: dateCounts.get(dateKey) || 0,
      };
    });
  });

  readonly activeDateKey = computed((): string | null => {
    const pills = this.datePills();
    if (pills.length === 0) {
      return null;
    }
    const userSelected = this.selectedDate();
    if (userSelected && pills.some((p) => p.dateKey === userSelected)) {
      return userSelected;
    }
    const todayPill = pills.find((p) => p.isToday);
    return todayPill ? todayPill.dateKey : pills[0].dateKey;
  });

  readonly activeDateLabel = computed((): string => {
    const activeKey = this.activeDateKey();
    if (!activeKey) return '';
    const pill = this.datePills().find((p) => p.dateKey === activeKey);
    return pill ? pill.fullLabel : activeKey;
  });

  readonly selectedUpcomingAppointments = computed(
    (): StaffAppointmentRow[] => {
      const activeKey = this.activeDateKey();
      if (!activeKey) {
        return [];
      }
      return this.appointments()
        .filter((a) => a.clinicDate.split('T')[0] === activeKey)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    },
  );

  selectDate(dateKey: string): void {
    this.selectedDate.set(dateKey);
  }

  setTab(tab: StaffAppointmentsTab): void {
    this.activeTab.set(tab);
  }

  onRetryAppointments(): void {
    this.retryAppointments.emit();
  }
}

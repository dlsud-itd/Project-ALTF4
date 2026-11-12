import { AppointmentStatus } from '@core/models';

export type AppointmentTagSeverity =
  'info' | 'success' | 'secondary' | 'danger';

export type StaffAppointmentRow = {
  id: number;
  patientName: string;
  clinicDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
};

const TIME_SEPARATOR = ':';
const TIME_RANGE_SEPARATOR = ' to ';
const HOURS_PER_DAY = 24;
const NOON_HOUR = 12;

export const dateDisplayFormat = 'EEE, MMM d';

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

const APPOINTMENT_STATUS_SEVERITIES: Record<
  AppointmentStatus,
  AppointmentTagSeverity
> = {
  BOOKED: 'info',
  CANCELLED: 'secondary',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
};

export const SAMPLE_APPOINTMENTS: StaffAppointmentRow[] = [
  {
    id: 1,
    patientName: 'Sample Patient A',
    clinicDate: '2026-11-12',
    startTime: '08:00',
    endTime: '08:30',
    status: 'BOOKED',
  },
  {
    id: 2,
    patientName: 'Sample Patient B',
    clinicDate: '2026-11-12',
    startTime: '09:30',
    endTime: '10:00',
    status: 'BOOKED',
  },
  {
    id: 3,
    patientName: 'Sample Patient C',
    clinicDate: '2026-11-13',
    startTime: '13:00',
    endTime: '13:30',
    status: 'COMPLETED',
  },
  {
    id: 4,
    patientName: 'Sample Patient D',
    clinicDate: '2026-11-13',
    startTime: '15:30',
    endTime: '16:00',
    status: 'NO_SHOW',
  },
];

function formatTime12h(time: string): string {
  const [hourText, minuteText] = time.split(TIME_SEPARATOR);
  const hour = Number(hourText) % HOURS_PER_DAY;
  const suffix = hour >= NOON_HOUR ? 'PM' : 'AM';
  const displayHour = hour % NOON_HOUR === 0 ? NOON_HOUR : hour % NOON_HOUR;
  return `${displayHour}${TIME_SEPARATOR}${minuteText} ${suffix}`;
}

export function appointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_LABELS[status];
}

export function appointmentStatusSeverity(
  status: AppointmentStatus,
): AppointmentTagSeverity {
  return APPOINTMENT_STATUS_SEVERITIES[status];
}

export function appointmentTimeRange(row: StaffAppointmentRow): string {
  return (
    formatTime12h(row.startTime) +
    TIME_RANGE_SEPARATOR +
    formatTime12h(row.endTime)
  );
}

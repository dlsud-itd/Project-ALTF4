import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AdminService } from '@core/services';
import { AdminAppointment, AdminStats, AdminUser } from '@core/models';
import {
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import { getErrorMessage, toDateParam } from '@core/utils';

type MonthPoint = {
  label: string;
  fullLabel: string;
  visits: number;
  newPatients: number;
};

type ChartView = 'graph' | 'table';
type DayPoint = { label: string; scheduled: number; completed: number };

// SVG drawing area shared by both charts, in viewBox units.
const CHART = { width: 640, height: 250, left: 40, right: 12, top: 12, bottom: 28 };
const PLOT_WIDTH = CHART.width - CHART.left - CHART.right;
const PLOT_HEIGHT = CHART.height - CHART.top - CHART.bottom;
const BASELINE = CHART.top + PLOT_HEIGHT;
const GRID_STEPS = 4;
// The small graphics inside the summary cards, in their own viewBox units.
const SPARK = { width: 280, height: 44, pad: 5 };
const SPARK_MONTHS = 6;
const AUDIT_DAYS = 12;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// A round axis maximum that splits into four whole-number steps.
const axisMax = (largest: number): number => {
  const rough = Math.max(1, Math.ceil(largest / GRID_STEPS));
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((n) => n * magnitude).find((n) => n >= rough) ?? rough;
  return step * GRID_STEPS;
};

const yFor = (value: number, max: number): number =>
  BASELINE - (value / max) * PLOT_HEIGHT;

const axisTicks = (max: number): { value: number; y: number }[] =>
  Array.from({ length: GRID_STEPS + 1 }, (_, index) => {
    const value = (max / GRID_STEPS) * index;
    return { value, y: yFor(value, max) };
  });

// A bar with a rounded top that sits flat on the baseline.
const barPath = (x: number, width: number, value: number, max: number): string => {
  if (value <= 0) {
    return '';
  }
  const top = yFor(value, max);
  const radius = Math.min(4, width / 2, BASELINE - top);
  return `M${x},${BASELINE} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + width - radius} Q${x + width},${top} ${x + width},${top + radius} V${BASELINE} Z`;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly stats = signal<AdminStats | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Chart data loads on its own, so a failure there leaves the totals usable.
  private readonly appointments = signal<AdminAppointment[]>([]);
  private readonly users = signal<AdminUser[]>([]);
  // Daily audit activity; stays null if it cannot load, which hides its bars.
  private readonly auditTimes = signal<string[] | null>(null);
  readonly spark = SPARK;
  readonly isChartLoading = signal<boolean>(true);
  readonly chartError = signal<string | null>(null);
  readonly monthRange = signal<number>(8);
  readonly monthRanges = [6, 8, 12];
  // Each chart card switches between its graph and its figures.
  readonly trendView = signal<ChartView>('graph');
  readonly weekView = signal<ChartView>('graph');
  readonly chart = CHART;
  readonly baseline = BASELINE;

  readonly monthPoints = computed<MonthPoint[]>(() => {
    const now = new Date();
    const count = this.monthRange();
    return Array.from({ length: count }, (_, index) => {
      const month = new Date(
        now.getFullYear(),
        now.getMonth() - (count - 1 - index),
        1,
      );
      const key = toDateParam(month).slice(0, 7);
      return {
        label: month.toLocaleDateString('en-US', { month: 'short' }),
        fullLabel: month.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
        visits: this.appointments().filter(
          (appt) =>
            appt.status !== 'CANCELLED' &&
            appt.slot.clinicDate.slice(0, 7) === key,
        ).length,
        newPatients: this.users().filter(
          (user) =>
            user.role === 'PATIENT' &&
            toDateParam(new Date(user.createdAt)).slice(0, 7) === key,
        ).length,
      };
    });
  });

  // Monday to Sunday of the current week.
  readonly weekPoints = computed<DayPoint[]>(() => {
    const now = new Date();
    const daysSinceMonday = (now.getDay() + 6) % 7;
    return WEEKDAYS.map((label, index) => {
      const date = toDateParam(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - daysSinceMonday + index,
        ),
      );
      const booked = this.appointments().filter(
        (appt) =>
          appt.status !== 'CANCELLED' &&
          appt.slot.clinicDate.slice(0, 10) === date,
      );
      return {
        label,
        scheduled: booked.length,
        completed: booked.filter((appt) => appt.status === 'COMPLETED').length,
      };
    });
  });

  readonly trendChart = computed(() => {
    const points = this.monthPoints();
    const max = axisMax(
      Math.max(...points.map((p) => Math.max(p.visits, p.newPatients))),
    );
    const spacing = PLOT_WIDTH / Math.max(1, points.length - 1);
    const placed = points.map((point, index) => ({
      ...point,
      x: CHART.left + spacing * index,
      visitsY: yFor(point.visits, max),
      newPatientsY: yFor(point.newPatients, max),
    }));
    const line = (key: 'visitsY' | 'newPatientsY'): string =>
      placed.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p[key]}`).join(' ');
    const area = (key: 'visitsY' | 'newPatientsY'): string =>
      `${line(key)} L${placed[placed.length - 1].x},${BASELINE} L${placed[0].x},${BASELINE} Z`;

    return {
      points: placed,
      ticks: axisTicks(max),
      hitWidth: spacing,
      visitsLine: line('visitsY'),
      visitsArea: area('visitsY'),
      newPatientsLine: line('newPatientsY'),
      newPatientsArea: area('newPatientsY'),
    };
  });

  readonly weekChart = computed(() => {
    const days = this.weekPoints();
    const max = axisMax(Math.max(...days.map((day) => day.scheduled)));
    const groupWidth = PLOT_WIDTH / days.length;
    const barWidth = Math.min(20, groupWidth / 2 - 6);

    return {
      ticks: axisTicks(max),
      groupWidth,
      days: days.map((day, index) => {
        const groupX = CHART.left + groupWidth * index;
        const center = groupX + groupWidth / 2;
        // A 2px gap separates the pair.
        return {
          ...day,
          groupX,
          center,
          scheduledPath: barPath(center - barWidth - 1, barWidth, day.scheduled, max),
          completedPath: barPath(center + 1, barWidth, day.completed, max),
        };
      }),
    };
  });

  // Appointments per month for the last six months, as a smooth line.
  readonly sparkline = computed(() => {
    const months = this.monthPoints().slice(-SPARK_MONTHS);
    const largest = Math.max(1, ...months.map((month) => month.visits));
    const step = (SPARK.width - SPARK.pad * 2) / (months.length - 1);
    const points = months.map((month, index) => ({
      label: month.fullLabel,
      value: month.visits,
      x: SPARK.pad + step * index,
      y:
        SPARK.height -
        SPARK.pad -
        (month.visits / largest) * (SPARK.height - SPARK.pad * 2),
    }));
    // Level control points keep the curve from overshooting the real values.
    const line = points
      .map((point, index) => {
        if (index === 0) {
          return `M${point.x},${point.y}`;
        }
        const previous = points[index - 1];
        const middle = (previous.x + point.x) / 2;
        return `C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`;
      })
      .join(' ');
    return {
      points,
      line,
      area: `${line} L${points[points.length - 1].x},${SPARK.height} L${points[0].x},${SPARK.height} Z`,
      summary: points.map((p) => `${p.label}: ${p.value}`).join(', '),
    };
  });

  // Share of the active queue that is still waiting.
  readonly waitingShare = computed<number>(() => {
    const s = this.stats();
    const active = s ? s.waitingQueueCount + s.inConsultationCount : 0;
    return s && active > 0
      ? Math.round((s.waitingQueueCount / active) * 100)
      : 0;
  });

  readonly auditBars = computed(() => {
    const times = this.auditTimes();
    if (!times) {
      return null;
    }
    const now = new Date();
    const days = Array.from({ length: AUDIT_DAYS }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (AUDIT_DAYS - 1 - index),
      );
      const key = toDateParam(date);
      return {
        label: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        count: times.filter((time) => toDateParam(new Date(time)) === key)
          .length,
      };
    });
    const largest = Math.max(1, ...days.map((day) => day.count));
    return days.map((day) => ({
      ...day,
      // Days with no events keep a sliver so the axis stays readable.
      height: day.count === 0 ? 4 : Math.max(12, (day.count / largest) * 100),
      isBusy: day.count >= largest * 0.6,
    }));
  });

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.adminService.getStats().subscribe({
      next: (res) => {
        this.stats.set(res.stats);
        this.isLoading.set(false);
        this.loadCharts();
        this.loadAuditActivity();
      },
      error: (err) => {
        this.error.set(
          getErrorMessage(err, 'Failed to retrieve administrative statistics'),
        );
        this.isLoading.set(false);
      },
    });
  }

  loadCharts(): void {
    this.isChartLoading.set(true);
    this.chartError.set(null);

    forkJoin({
      appointments: this.adminService.getAppointments(),
      users: this.adminService.getUsers(),
    }).subscribe({
      next: (res) => {
        this.appointments.set(res.appointments.appointments);
        this.users.set(res.users.users);
        this.isChartLoading.set(false);
      },
      error: (err) => {
        this.chartError.set(
          getErrorMessage(err, 'Failed to retrieve chart data'),
        );
        this.isChartLoading.set(false);
      },
    });
  }

  private loadAuditActivity(): void {
    this.adminService.getAuditLogs().subscribe({
      next: (res) =>
        this.auditTimes.set(res.auditLogs.map((log) => log.occurredAt)),
      error: () => this.auditTimes.set(null),
    });
  }

  onRangeChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      this.monthRange.set(Number(target.value));
    }
  }

  // Downloads the totals and chart figures shown on this page as a CSV file.
  onExportReport(): void {
    const s = this.stats();
    if (!s) {
      return;
    }
    const rows: (string | number)[][] = [
      ['ClinicQueue admin report', toDateParam(new Date())],
      [],
      ['Metric', 'Value'],
      ['Total registered users', s.totalUsers],
      ['Patients', s.totalPatients],
      ['Staff', s.totalStaff],
      ['System administrators', s.totalAdmins],
      ['Appointments today', s.todayAppointments],
      ['Lifetime appointments', s.totalAppointments],
      ['Waiting in queue', s.waitingQueueCount],
      ['In consultation', s.inConsultationCount],
      ['Audit trail events', s.totalAuditLogs],
      [],
      ['Month', 'Appointments (not cancelled)', 'New patients'],
      ...this.monthPoints().map((p) => [p.fullLabel, p.visits, p.newPatients]),
      [],
      ['This week', 'Scheduled (not cancelled)', 'Completed'],
      ...this.weekPoints().map((d) => [d.label, d.scheduled, d.completed]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `clinicqueue-report-${toDateParam(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

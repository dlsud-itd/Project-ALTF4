import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { AdminService } from '@core/services';
import { AdminAuditLog } from '@core/models';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
  PaginatorComponent,
  ViewToggleComponent,
  DataViewMode,
} from '@shared/ui';
import { getErrorMessage } from '@core/utils';

type ActionCategory = 'ALL' | 'USER' | 'APPOINTMENT' | 'QUEUE';
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputText,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
    PaginatorComponent,
    ViewToggleComponent,
  ],
  templateUrl: './admin-audit-logs.component.html',
  styleUrl: './admin-audit-logs.component.scss',
})
export class AdminAuditLogsComponent implements OnInit {
  private static readonly ACTION_LABELS: Record<string, string> = {
    APPOINTMENT_BOOKED: 'Appointment Booked',
    APPOINTMENT_CANCELLED: 'Appointment Cancelled',
    APPOINTMENT_RESCHEDULED: 'Appointment Rescheduled',
    ADMIN_USER_CREATED: 'User Created',
    ADMIN_USER_UPDATED: 'User Updated',
    ADMIN_USER_DEACTIVATED: 'User Deactivated',
    QUEUE_CALLED: 'Patient Called',
    QUEUE_COMPLETED: 'Consultation Done',
    QUEUE_NO_SHOW: 'Marked No-Show',
    QUEUE_RECALLED: 'Patient Recalled',
    QUEUE_WAITING: 'Joined Queue',
  };

  private readonly adminService = inject(AdminService);

  readonly logs = signal<AdminAuditLog[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // Filters & layout
  readonly searchQuery = signal<string>('');
  readonly categoryFilter = signal<ActionCategory>('ALL');
  readonly viewMode = signal<DataViewMode>('table');
  readonly expandedLogId = signal<number | null>(null);

  // Pagination
  readonly first = signal<number>(0);
  readonly rows = signal<number>(10);

  readonly filteredLogs = computed<AdminAuditLog[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.categoryFilter();
    let list = this.logs();

    if (category === 'USER') {
      list = list.filter((l) => l.action.includes('USER'));
    } else if (category === 'APPOINTMENT') {
      list = list.filter((l) => l.action.includes('APPOINTMENT'));
    } else if (category === 'QUEUE') {
      list = list.filter((l) => l.action.includes('QUEUE'));
    }

    if (query) {
      list = list.filter(
        (l) =>
          l.action.toLowerCase().includes(query) ||
          l.entityTable.toLowerCase().includes(query) ||
          (l.description && l.description.toLowerCase().includes(query)) ||
          (l.actor &&
            (l.actor.fullName.toLowerCase().includes(query) ||
              l.actor.email.toLowerCase().includes(query))),
      );
    }

    return list;
  });

  readonly pagedLogs = computed<AdminAuditLog[]>(() => {
    const list = this.filteredLogs();
    const offset = this.first();
    const size = this.rows();
    return list.slice(offset, offset + size);
  });

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.adminService.getAuditLogs().subscribe({
      next: (res) => {
        this.logs.set(res.auditLogs);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(
          getErrorMessage(err, 'Failed to retrieve administrative audit trail'),
        );
        this.isLoading.set(false);
      },
    });
  }

  setCategoryFilter(category: ActionCategory): void {
    this.categoryFilter.set(category);
    this.first.set(0);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.first.set(0);
  }

  toggleExpand(id: number): void {
    this.expandedLogId.update((curr) => (curr === id ? null : id));
  }

  formatActionLabel(action: string): string {
    if (AdminAuditLogsComponent.ACTION_LABELS[action]) {
      return AdminAuditLogsComponent.ACTION_LABELS[action];
    }
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  actionIcon(action: string): string {
    if (action.includes('CANCEL') || action.includes('DEACTIVATED')) {
      return 'pi pi-times-circle';
    }
    if (action.includes('BOOKED') || action.includes('CREATED') || action.includes('COMPLETED')) {
      return 'pi pi-check-circle';
    }
    if (action.includes('RESCHEDULED') || action.includes('UPDATED')) {
      return 'pi pi-sync';
    }
    if (action.includes('QUEUE')) {
      return 'pi pi-bell';
    }
    return 'pi pi-info-circle';
  }

  actionSeverity(action: string): TagSeverity {
    if (action.includes('DEACTIVATED') || action.includes('CANCEL')) {
      return 'danger';
    }
    if (action.includes('CREATED') || action.includes('COMPLETED')) {
      return 'success';
    }
    if (action.includes('UPDATED') || action.includes('RESCHEDULE')) {
      return 'warn';
    }
    return 'info';
  }

  formatDatePart(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatTimePart(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatEntityLabel(table: string, id: number | null): string {
    const cleanTable = table.replace(/_/g, ' ').replace('app ', '');
    const capitalized = cleanTable.charAt(0).toUpperCase() + cleanTable.slice(1);
    return id !== null ? `${capitalized} #${id}` : capitalized;
  }
}

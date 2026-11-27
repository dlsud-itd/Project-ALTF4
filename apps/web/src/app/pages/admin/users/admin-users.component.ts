import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { AdminService, AppConfirmService, AuthService } from '@core/services';
import { AccessRole, ClinicAffiliation, AdminUser } from '@core/models';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
  NoticeComponent,
  NoticeVariant,
  PaginatorComponent,
  ViewToggleComponent,
  DataViewMode,
} from '@shared/ui';
import {
  getErrorMessage,
  normalizePhMobile,
  phMobileValidator,
} from '@core/utils';

type RoleFilter = 'ALL' | 'PATIENT' | 'STAFF' | 'ADMIN';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Tag,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
    NoticeComponent,
    PaginatorComponent,
    ViewToggleComponent,
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly confirmService = inject(AppConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<AdminUser[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<{ message: string; variant: NoticeVariant } | null>(null);

  // Filters & layout state
  readonly searchQuery = signal<string>('');
  readonly roleFilter = signal<RoleFilter>('ALL');
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly viewMode = signal<DataViewMode>('table');

  // Pagination state
  readonly first = signal<number>(0);
  readonly rows = signal<number>(10);

  // Modals state
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly isEditModalOpen = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly modalError = signal<string | null>(null);
  readonly editingUser = signal<AdminUser | null>(null);

  readonly currentUserId = computed<number | null>(() => {
    return this.authService.currentUser()?.id ?? null;
  });

  // Create Form
  readonly createForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phoneNumber: ['', [Validators.required, phMobileValidator, Validators.maxLength(30)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: [AccessRole.PATIENT, [Validators.required]],
    affiliation: [ClinicAffiliation.STUDENT, [Validators.required]],
  });

  // Edit Form
  readonly editForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phoneNumber: ['', [Validators.required, phMobileValidator, Validators.maxLength(30)]],
    password: ['', [Validators.minLength(6)]],
    role: [AccessRole.PATIENT, [Validators.required]],
    affiliation: [ClinicAffiliation.STUDENT, [Validators.required]],
    isActive: [true],
  });

  readonly availableRoles = [
    { label: 'Patient', value: AccessRole.PATIENT },
    { label: 'Staff Member', value: AccessRole.STAFF },
    { label: 'Administrator', value: AccessRole.ADMIN },
  ];

  readonly availableAffiliations = [
    { label: 'Student', value: ClinicAffiliation.STUDENT },
    { label: 'Faculty', value: ClinicAffiliation.FACULTY },
    { label: 'Staff', value: ClinicAffiliation.STAFF },
  ];

  readonly filteredUsers = computed<AdminUser[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();
    let list = this.users();

    if (role !== 'ALL') {
      list = list.filter((u) => u.role === role);
    }

    if (status === 'ACTIVE') {
      list = list.filter((u) => u.isActive);
    } else if (status === 'INACTIVE') {
      list = list.filter((u) => !u.isActive);
    }

    if (query) {
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      );
    }

    return list;
  });

  readonly pagedUsers = computed<AdminUser[]>(() => {
    const list = this.filteredUsers();
    const offset = this.first();
    const size = this.rows();
    return list.slice(offset, offset + size);
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.adminService.getUsers().subscribe({
      next: (res) => {
        this.users.set(res.users);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(getErrorMessage(err, 'Failed to retrieve user registry'));
        this.isLoading.set(false);
      },
    });
  }

  setRoleFilter(filter: RoleFilter): void {
    this.roleFilter.set(filter);
    this.first.set(0);
  }

  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
    this.first.set(0);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.first.set(0);
  }

  openCreateModal(): void {
    this.modalError.set(null);
    this.createForm.reset({
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      role: AccessRole.PATIENT,
      affiliation: ClinicAffiliation.STUDENT,
    });
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.modalError.set(null);

    const val = this.createForm.value;
    this.adminService
      .createUser({
        fullName: val.fullName!,
        email: val.email!,
        phoneNumber: normalizePhMobile(val.phoneNumber!),
        password: val.password!,
        role: val.role as AccessRole,
        affiliation: val.affiliation as ClinicAffiliation,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.isCreateModalOpen.set(false);
          this.notice.set({
            message: `User ${res.user.fullName} created successfully.`,
            variant: NoticeVariant.SUCCESS,
          });
          this.loadUsers();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.modalError.set(getErrorMessage(err, 'Failed to create user'));
        },
      });
  }

  openEditModal(user: AdminUser): void {
    this.editingUser.set(user);
    this.modalError.set(null);
    this.editForm.reset({
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber ?? '',
      password: '',
      role: user.role as AccessRole,
      affiliation: user.affiliation as ClinicAffiliation,
      isActive: user.isActive,
    });
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.editingUser.set(null);
  }

  submitEdit(): void {
    const user = this.editingUser();
    if (!user || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.modalError.set(null);

    const val = this.editForm.value;
    const dto: Record<string, unknown> = {
      fullName: val.fullName!,
      email: val.email!,
      phoneNumber: normalizePhMobile(val.phoneNumber!),
      role: val.role as AccessRole,
      affiliation: val.affiliation as ClinicAffiliation,
      isActive: val.isActive!,
    };

    if (val.password && val.password.trim().length >= 6) {
      dto['password'] = val.password.trim();
    }

    this.adminService.updateUser(user.id, dto).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.isEditModalOpen.set(false);
        this.notice.set({
          message: `User ${res.user.fullName} updated successfully.`,
          variant: NoticeVariant.SUCCESS,
        });
        this.loadUsers();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.modalError.set(getErrorMessage(err, 'Failed to update user'));
      },
    });
  }

  toggleActive(user: AdminUser): void {
    if (user.id === this.currentUserId()) {
      this.notice.set({
        message: 'You cannot deactivate your own active session.',
        variant: NoticeVariant.WARNING,
      });
      return;
    }

    const newStatus = !user.isActive;
    const actionWord = newStatus ? 'activate' : 'deactivate';

    this.confirmService.confirmWarning({
      header: newStatus ? 'Reactivate Account' : 'Suspend Account',
      message: newStatus
        ? `Restore sign-in access for ${user.fullName} (${user.email})?`
        : `Suspend access for ${user.fullName} (${user.email})? They cannot sign in until you reactivate the account.`,
      icon: newStatus ? 'pi pi-check-circle' : 'pi pi-ban',
      acceptLabel: newStatus ? 'Yes, reactivate' : 'Yes, suspend',
      accept: () => {
        this.adminService
          .updateUser(user.id, { isActive: newStatus })
          .subscribe({
            next: () => {
              this.notice.set({
                message: `Account for ${user.fullName} is now ${newStatus ? 'active' : 'inactive'}.`,
                variant: NoticeVariant.SUCCESS,
              });
              this.loadUsers();
            },
            error: (err) => {
              this.notice.set({
                message: getErrorMessage(err, `Failed to ${actionWord} user`),
                variant: NoticeVariant.ERROR,
              });
            },
          });
      },
    });
  }

  confirmDeactivate(user: AdminUser): void {
    if (user.id === this.currentUserId()) {
      this.notice.set({
        message: 'You cannot deactivate your own administrative account.',
        variant: NoticeVariant.WARNING,
      });
      return;
    }

    this.confirmService.confirmDestructive({
      header: 'Deactivate User Account',
      message: `Are you sure you want to deactivate ${user.fullName}? They will be immediately blocked from signing in.`,
      icon: 'pi pi-user-minus',
      acceptLabel: 'Deactivate Account',
      accept: () => {
        this.adminService.deleteUser(user.id).subscribe({
          next: () => {
            this.notice.set({
              message: `User ${user.fullName} deactivated successfully.`,
              variant: NoticeVariant.SUCCESS,
            });
            this.loadUsers();
          },
          error: (err) => {
            this.notice.set({
              message: getErrorMessage(err, 'Failed to deactivate user'),
              variant: NoticeVariant.ERROR,
            });
          },
        });
      },
    });
  }

  roleSeverity(role: string): TagSeverity {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return 'danger';
      case 'STAFF':
        return 'info';
      case 'PATIENT':
      default:
        return 'success';
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

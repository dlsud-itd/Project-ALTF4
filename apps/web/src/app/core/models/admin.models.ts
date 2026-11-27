import { AccessRole, ClinicAffiliation } from './auth.models';
import { AppointmentStatus } from './appointment.models';
import { ClinicSlot } from './slot.models';

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: AccessRole | string;
  affiliation: ClinicAffiliation | string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  appointmentCount?: number;
  queueCount?: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
}

export interface AdminCreateUserRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: AccessRole;
  affiliation: ClinicAffiliation;
}

export interface AdminUpdateUserRequest {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  role?: AccessRole;
  affiliation?: ClinicAffiliation;
  isActive?: boolean;
}

export interface AdminStats {
  totalUsers: number;
  totalPatients: number;
  totalStaff: number;
  totalAdmins: number;
  totalAppointments: number;
  todayAppointments: number;
  waitingQueueCount: number;
  inConsultationCount: number;
  totalAuditLogs: number;
}

export interface AdminStatsResponse {
  stats: AdminStats;
}

export interface AdminAuditLog {
  id: number;
  actorId: number | null;
  actor: {
    id: number;
    fullName: string;
    email: string;
    role: string;
  } | null;
  action: string;
  entityTable: string;
  entityId: number | null;
  description: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  occurredAt: string;
}

export interface AdminAuditLogsResponse {
  auditLogs: AdminAuditLog[];
}

export interface AdminAppointment {
  id: number;
  status: AppointmentStatus;
  createdAt: string;
  patient: {
    id: number;
    fullName: string;
    email: string;
    affiliation: string;
  };
  slot: ClinicSlot;
  ticketNumber?: string | null;
  reasonForVisit?: string | null;
}

export interface AdminAppointmentsResponse {
  appointments: AdminAppointment[];
}

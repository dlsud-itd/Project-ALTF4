import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  AdminAppointmentsResponse,
  AdminAuditLogsResponse,
  AdminCreateUserRequest,
  AdminStatsResponse,
  AdminUpdateUserRequest,
  AdminUser,
  AdminUsersResponse,
} from '../models/admin.models';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  private get baseUrl(): string {
    return `${this.apiConfig.apiUrl}/admin`;
  }

  getUsers(): Observable<AdminUsersResponse> {
    return this.http.get<AdminUsersResponse>(`${this.baseUrl}/users`);
  }

  createUser(
    dto: AdminCreateUserRequest,
  ): Observable<{ message: string; user: AdminUser }> {
    return this.http.post<{ message: string; user: AdminUser }>(
      `${this.baseUrl}/users`,
      dto,
    );
  }

  updateUser(
    id: number,
    dto: AdminUpdateUserRequest,
  ): Observable<{ message: string; user: AdminUser }> {
    return this.http.patch<{ message: string; user: AdminUser }>(
      `${this.baseUrl}/users/${id}`,
      dto,
    );
  }

  deleteUser(id: number): Observable<{ message: string; user: AdminUser }> {
    return this.http.delete<{ message: string; user: AdminUser }>(
      `${this.baseUrl}/users/${id}`,
    );
  }

  getStats(): Observable<AdminStatsResponse> {
    return this.http.get<AdminStatsResponse>(`${this.baseUrl}/stats`);
  }

  getAuditLogs(): Observable<AdminAuditLogsResponse> {
    return this.http.get<AdminAuditLogsResponse>(`${this.baseUrl}/audit-logs`);
  }

  getAppointments(): Observable<AdminAppointmentsResponse> {
    return this.http.get<AdminAppointmentsResponse>(
      `${this.baseUrl}/appointments`,
    );
  }
}

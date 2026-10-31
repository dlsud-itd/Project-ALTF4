import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  AppointmentBookingResponse,
  AppointmentMutationResponse,
  AppointmentsResponse,
  CreateAppointmentRequest,
} from '../models/appointment.models';

@Injectable({
  providedIn: 'root',
})
export class AppointmentsService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
  ) {}

  getMyAppointments(): Observable<AppointmentsResponse> {
    return this.http.get<AppointmentsResponse>(
      `${this.apiConfig.apiUrl}/appointments/my`,
    );
  }

  bookAppointment(
    dto: CreateAppointmentRequest,
  ): Observable<AppointmentBookingResponse> {
    return this.http.post<AppointmentBookingResponse>(
      `${this.apiConfig.apiUrl}/appointments`,
      dto,
    );
  }

  cancelAppointment(id: number): Observable<AppointmentMutationResponse> {
    return this.http.patch<AppointmentMutationResponse>(
      `${this.apiConfig.apiUrl}/appointments/${id}/cancel`,
      {},
    );
  }
}


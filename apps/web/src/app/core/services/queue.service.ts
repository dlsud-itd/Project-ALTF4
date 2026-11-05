import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { AuthService } from './auth.service';
import {
  QueueStatusResponse,
  WalkInRequest,
  WalkInResponse,
  CallNextRequest,
  CallNextResponse,
  UpdateEntryStatusRequest,
  UpdateEntryStatusResponse,
  TrackingStatusResponse,
} from '../models/queue.models';

@Injectable({
  providedIn: 'root',
})
export class QueueService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
    private readonly authService: AuthService,
  ) {}

  getQueueStatus(queueId: number): Observable<QueueStatusResponse> {
    return this.http.get<QueueStatusResponse>(`${this.apiConfig.apiUrl}/queues/${queueId}/status`);
  }

  joinWalkIn(queueId: number, req: WalkInRequest): Observable<WalkInResponse> {
    return this.http.post<WalkInResponse>(`${this.apiConfig.apiUrl}/queues/${queueId}/walk-in`, req);
  }

  trackByToken(token: string): Observable<TrackingStatusResponse> {
    return this.http.get<TrackingStatusResponse>(
      `${this.apiConfig.apiUrl}/queues/track/${encodeURIComponent(token)}`,
    );
  }

  generateStaffQueueNumber(queueId: number, req: WalkInRequest): Observable<WalkInResponse> {
    return this.http.post<WalkInResponse>(
      `${this.apiConfig.apiUrl}/queues/${queueId}/staff-generated`,
      req,
      { headers: this.authService.getAuthHeaders() },
    );
  }

  callNext(queueId: number, req: CallNextRequest): Observable<CallNextResponse> {
    return this.http.post<CallNextResponse>(
      `${this.apiConfig.apiUrl}/queues/${queueId}/call-next`,
      req,
      { headers: this.authService.getAuthHeaders() },
    );
  }

  updateEntryStatus(
    queueId: number,
    entryId: number,
    req: UpdateEntryStatusRequest,
  ): Observable<UpdateEntryStatusResponse> {
    return this.http.patch<UpdateEntryStatusResponse>(
      `${this.apiConfig.apiUrl}/queues/${queueId}/entries/${entryId}`,
      req,
      { headers: this.authService.getAuthHeaders() },
    );
  }
}

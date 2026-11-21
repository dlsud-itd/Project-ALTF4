import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MarkAllNotificationsReadResponse,
  NotificationsListResponse,
  PatientNotification,
} from '../models';
import { ApiConfigService } from './api-config.service';

const NOTIFICATIONS_PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
  ) {}

  getMyNotifications(page = 1): Observable<NotificationsListResponse> {
    const params = new HttpParams()
      .set('page', page)
      .set('limit', NOTIFICATIONS_PAGE_SIZE);
    return this.http.get<NotificationsListResponse>(
      `${this.apiConfig.apiUrl}/notifications`,
      { params },
    );
  }

  markAsRead(id: number): Observable<PatientNotification> {
    return this.http.patch<PatientNotification>(
      `${this.apiConfig.apiUrl}/notifications/${id}/read`,
      {},
    );
  }

  markAllAsRead(): Observable<MarkAllNotificationsReadResponse> {
    return this.http.patch<MarkAllNotificationsReadResponse>(
      `${this.apiConfig.apiUrl}/notifications/read-all`,
      {},
    );
  }
}

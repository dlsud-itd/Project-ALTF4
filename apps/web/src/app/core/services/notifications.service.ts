import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
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
    private readonly zone: NgZone,
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

  streamNotifications(token: string): Observable<void> {
    return new Observable<void>((observer) => {
      if (typeof window === 'undefined' || typeof fetch === 'undefined') {
        observer.complete();
        return;
      }

      const controller = new AbortController();
      const streamUrl = `${this.apiConfig.apiUrl}/notifications/stream`;

      const connect = async (): Promise<void> => {
        try {
          const response = await fetch(streamUrl, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'text/event-stream',
            },
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            observer.complete();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() ?? '';

            for (const block of blocks) {
              if (block.includes('data:')) {
                this.zone.run(() => observer.next());
              }
            }
          }
          observer.complete();
        } catch {
          if (!controller.signal.aborted) {
            observer.complete();
          }
        }
      };

      void connect();

      return () => {
        controller.abort();
      };
    });
  }
}

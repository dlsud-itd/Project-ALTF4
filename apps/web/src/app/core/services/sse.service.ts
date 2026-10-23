import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ApiConfigService } from './api-config.service';

// Real-time payload dispatched when a patient ticket is called to a station.
export type QueueCalledEvent = {
  queueId: number;
  queueEntryId: number;
  ticketNumber: string;
  patientName: string;
  roomNumber: string;
  calledAt: string;
};

// Real-time payload dispatched when queue status or total waiting counts change.
export type QueueUpdatedEvent = {
  queueId: number;
  queueEntryId?: number;
  ticketNumber?: string;
  status: string;
  totalWaiting: number;
  timestamp: string;
};

// Tracks the active lifecycle states of the Server-Sent Events stream.
export enum SseConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
}

// Service managing Server-Sent Events connections to stream live queue updates to Angular components.
@Injectable({
  providedIn: 'root',
})
export class SseService implements OnDestroy {
  private eventSource: EventSource | null = null;
  private currentQueueId: number | null = null;
  private readonly isConnected$ = new BehaviorSubject<boolean>(false);
  private readonly queueCalledSubject$ = new Subject<QueueCalledEvent>();
  private readonly queueUpdatedSubject$ = new Subject<QueueUpdatedEvent>();

  constructor(
    private readonly apiConfig: ApiConfigService,
    private readonly zone: NgZone,
  ) {}

  // Observable emitting the current connection status of the EventSource stream.
  get connected$(): Observable<boolean> {
    return this.isConnected$.asObservable();
  }

  // Observable streaming incoming patient call events for the subscribed queue.
  get queueCalled$(): Observable<QueueCalledEvent> {
    return this.queueCalledSubject$.asObservable();
  }

  // Observable streaming queue status changes and waiting count updates.
  get queueUpdated$(): Observable<QueueUpdatedEvent> {
    return this.queueUpdatedSubject$.asObservable();
  }

  // Establishes an EventSource stream for the given queue ID and listens for server events.
  subscribeToQueue(queueId: number): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.currentQueueId === queueId && this.eventSource) {
      return;
    }

    this.disconnect();
    this.currentQueueId = queueId;

    const sseUrl = `${this.apiConfig.apiUrl}/queues/${queueId}/events`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onopen = (): void => {
      this.zone.run(() => {
        this.isConnected$.next(true);
      });
    };

    this.eventSource.onerror = (): void => {
      this.zone.run(() => {
        this.isConnected$.next(false);
      });
    };

    this.eventSource.addEventListener('queue:called', (event: MessageEvent<string>): void => {
      this.zone.run(() => {
        try {
          const parsed: QueueCalledEvent = JSON.parse(event.data) as QueueCalledEvent;
          this.queueCalledSubject$.next(parsed);
        } catch {
          // Ignore malformed message
        }
      });
    });

    this.eventSource.addEventListener('queue:updated', (event: MessageEvent<string>): void => {
      this.zone.run(() => {
        try {
          const parsed: QueueUpdatedEvent = JSON.parse(event.data) as QueueUpdatedEvent;
          this.queueUpdatedSubject$.next(parsed);
        } catch {
          // Ignore malformed message
        }
      });
    });
  }

  // Closes the active EventSource connection and resets stream state.
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.currentQueueId = null;
      this.isConnected$.next(false);
    }
  }

  // Cleans up active EventSource connections and completes subject subscriptions upon service destruction.
  ngOnDestroy(): void {
    this.disconnect();
    this.isConnected$.complete();
    this.queueCalledSubject$.complete();
    this.queueUpdatedSubject$.complete();
  }
}

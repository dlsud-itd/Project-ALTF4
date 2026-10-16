import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export type QueueCalledEvent = {
  queueId: number;
  queueEntryId: number;
  ticketNumber: string;
  patientName: string;
  roomNumber: string;
  calledAt: string;
};

export type QueueUpdatedEvent = {
  queueId: number;
  queueEntryId?: number;
  ticketNumber?: string;
  status: string;
  totalWaiting: number;
  timestamp: string;
};

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly isConnected$ = new BehaviorSubject<boolean>(false);
  private readonly queueCalledSubject$ = new Subject<QueueCalledEvent>();
  private readonly queueUpdatedSubject$ = new Subject<QueueUpdatedEvent>();

  constructor(private readonly apiConfig: ApiConfigService) {
    this.initSocket();
  }

  get connected$(): Observable<boolean> {
    return this.isConnected$.asObservable();
  }

  get queueCalled$(): Observable<QueueCalledEvent> {
    return this.queueCalledSubject$.asObservable();
  }

  get queueUpdated$(): Observable<QueueUpdatedEvent> {
    return this.queueUpdatedSubject$.asObservable();
  }

  initSocket(): void {
    if (typeof window === 'undefined') return;

    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.apiConfig.wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected$.next(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnected$.next(false);
    });

    this.socket.on('connect_error', () => {
      this.isConnected$.next(false);
    });

    this.socket.on('queue:called', (data: QueueCalledEvent) => {
      this.queueCalledSubject$.next(data);
    });

    this.socket.on('queue:updated', (data: QueueUpdatedEvent) => {
      this.queueUpdatedSubject$.next(data);
    });
  }

  subscribeToQueue(queueId: number): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribeQueue', { queueId });
    }
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

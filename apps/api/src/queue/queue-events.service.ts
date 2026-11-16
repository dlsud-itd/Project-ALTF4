import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

export type QueueEventPayload = {
  queueId: number;
  event: string;
  data: unknown;
};

function presentPublicEvent(
  event: string,
  data: unknown,
): Record<string, unknown> {
  if (typeof data !== 'object' || data === null) {
    return {};
  }
  const payload = data as Record<string, unknown>;
  const statusFields = {
    ...(typeof payload.ticketNumber === 'string'
      ? { ticketNumber: payload.ticketNumber }
      : {}),
    ...(typeof payload.status === 'string' ? { status: payload.status } : {}),
    ...(typeof payload.timestamp === 'string'
      ? { timestamp: payload.timestamp }
      : {}),
  };

  if (event === 'queue:called') {
    return {
      ...statusFields,
      ...(typeof payload.roomNumber === 'string'
        ? { roomNumber: payload.roomNumber }
        : {}),
      ...(typeof payload.calledAt === 'string'
        ? { calledAt: payload.calledAt }
        : {}),
      ...(payload.recalled === true ? { recalled: true } : {}),
    };
  }

  return {
    ...statusFields,
    ...(typeof payload.totalWaiting === 'number'
      ? { totalWaiting: payload.totalWaiting }
      : {}),
  };
}

@Injectable()
export class QueueEventsService {
  private readonly queueEvents$ = new Subject<QueueEventPayload>();

  getQueueEvents(queueId: number): Observable<MessageEvent> {
    return this.queueEvents$.pipe(
      filter((event: QueueEventPayload) => event.queueId === queueId),
      map((event: QueueEventPayload) => ({
        data: presentPublicEvent(event.event, event.data),
        type: event.event,
      })),
    );
  }

  emit(queueId: number, event: string, data: unknown): void {
    this.queueEvents$.next({ queueId, event, data });
  }
}

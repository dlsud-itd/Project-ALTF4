import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

export type QueueEventPayload = {
  queueId: number;
  event: string;
  data: unknown;
};

@Injectable()
export class QueueEventsService {
  private readonly queueEvents$ = new Subject<QueueEventPayload>();

  getQueueEvents(queueId: number): Observable<MessageEvent> {
    return this.queueEvents$.pipe(
      filter((event: QueueEventPayload) => event.queueId === queueId),
      map(
        (event: QueueEventPayload) =>
          ({
            data: event.data,
            type: event.event,
          }) as MessageEvent,
      ),
    );
  }

  emit(queueId: number, event: string, data: unknown): void {
    this.queueEvents$.next({ queueId, event, data });
  }
}

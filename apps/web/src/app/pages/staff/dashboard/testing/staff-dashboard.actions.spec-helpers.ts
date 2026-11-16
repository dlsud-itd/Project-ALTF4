import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { QueueService } from '@core/services';

export function queryDashboardDocument(selector: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(selector);
}

export function conflictError(
  code: string,
  message: string,
): HttpErrorResponse {
  return new HttpErrorResponse({ status: 409, error: { code, message } });
}

export function spyOnQueueUpdate(): jasmine.Spy {
  return TestBed.inject(QueueService).updateEntryStatus as jasmine.Spy;
}

export function spyOnCallNext(): jasmine.Spy {
  return TestBed.inject(QueueService).callNext as jasmine.Spy;
}

export function spyOnRecall(): jasmine.Spy {
  return TestBed.inject(QueueService).recallCurrent as jasmine.Spy;
}

import { HttpErrorResponse } from '@angular/common/http';
import { AuthService, QueueService } from '@core/services';
import { QueueStatus, ServingTicket } from '@core/models';
import { NoticeVariant } from '@shared/ui';
import type { StaffDashboardFacade } from './staff-dashboard.facade';

const HTTP_CONFLICT = 409;
const ROOM_PREFIX = 'Counter';
const DEFAULT_PRACTITIONER_NAME = 'Staff Nurse';
const CALL_NEXT_ERROR = 'Could not call the next patient.';
const RECALL_ERROR = 'Could not recall the current patient.';
const COMPLETE_ERROR = 'Could not complete the consultation.';
const NO_SHOW_ERROR = 'Could not mark the patient as no-show.';
const CANCEL_ERROR = 'Could not cancel the ticket.';
const ACTION_FAILED_MESSAGE = 'Something went wrong. Please try again.';
const NO_CURRENT_TICKET_MESSAGE = 'No patient is being called right now.';
const EMPTY_QUEUE_MESSAGE = 'The queue is empty.';
const PATIENT_ALREADY_CALLED_MESSAGE = 'A patient is already being called.';
const PATIENT_MUST_ARRIVE_MESSAGE =
  'The patient must arrive before completing consultation.';
const QUEUE_EMPTY_MESSAGE = 'No patients are waiting.';
const STATION_BUSY_MESSAGE = 'A patient is already called or in consultation.';
const ALREADY_CALLED_MESSAGE =
  'Another staff member already called the next patient.';
const INVALID_TRANSITION_MESSAGE =
  "This ticket's status has changed. Refresh the queue and try again.";

type StatusErrorTarget = 'page' | 'complete-dialog' | 'status-dialog';

type StatusUpdateOptions = {
  notes?: string;
  fallbackMessage: string;
  errorTarget: StatusErrorTarget;
};

export class StaffDashboardQueueActions {
  constructor(
    private readonly dashboard: StaffDashboardFacade,
    private readonly authService: AuthService,
    private readonly queueService: QueueService,
  ) {}

  refreshGracePeriod(): void {
    this.dashboard.currentTimeMs.set(
      Date.now() + this.dashboard.serverClockOffsetMs,
    );
    const ticket = this.dashboard.currentTicket();
    if (
      ticket?.status !== QueueStatus.CALLED ||
      this.dashboard.graceRemainingSeconds() > 0 ||
      this.dashboard.expirationRequestEntryId === ticket.queue_entry_id
    ) {
      return;
    }

    this.dashboard.expirationRequestEntryId = ticket.queue_entry_id;
    this.updateCurrentStatus(QueueStatus.NO_SHOW, {
      fallbackMessage: NO_SHOW_ERROR,
      errorTarget: 'page',
    });
  }

  onPatientArrived(): void {
    if (!this.dashboard.currentTicket()) {
      this.dashboard.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (!this.dashboard.isCalled() || this.dashboard.isUpdatingStatus()) {
      return;
    }

    this.updateCurrentStatus(QueueStatus.IN_CONSULTATION, {
      fallbackMessage: 'Could not start the consultation.',
      errorTarget: 'page',
    });
  }

  // Opens the call next dialog with the room and practitioner prefilled.
  onCallNext(): void {
    this.dashboard.clearNotice();
    if (this.dashboard.currentTicket()) {
      this.dashboard.showNotice(
        PATIENT_ALREADY_CALLED_MESSAGE,
        NoticeVariant.INFO,
      );
      return;
    }
    if (this.dashboard.waitingCount() === 0) {
      this.dashboard.showNotice(EMPTY_QUEUE_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (this.dashboard.isGeneratingQueue()) {
      return;
    }

    this.dashboard.callNextForm.reset({
      room: `${ROOM_PREFIX} ${this.dashboard.counterNumber()}`,
      provider:
        this.authService.currentUser()?.fullName ?? DEFAULT_PRACTITIONER_NAME,
    });
    this.dashboard.callNextError.set(null);
    this.dashboard.isCallNextDialogOpen.set(true);
  }

  onCancelCallNext(): void {
    this.dashboard.isCallNextDialogOpen.set(false);
  }

  onCallNextVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.onCancelCallNext();
    }
  }

  onConfirmCallNext(): void {
    if (this.dashboard.isGeneratingQueue()) {
      return;
    }
    if (this.dashboard.currentTicket()) {
      this.dashboard.showNotice(
        PATIENT_ALREADY_CALLED_MESSAGE,
        NoticeVariant.INFO,
      );
      this.dashboard.isCallNextDialogOpen.set(false);
      return;
    }
    if (this.dashboard.waitingCount() === 0) {
      this.dashboard.showNotice(EMPTY_QUEUE_MESSAGE, NoticeVariant.INFO);
      this.dashboard.isCallNextDialogOpen.set(false);
      return;
    }
    if (this.dashboard.callNextForm.invalid) {
      this.dashboard.callNextForm.markAllAsTouched();
      return;
    }

    const formValue = this.dashboard.callNextForm.getRawValue();
    this.dashboard.isGeneratingQueue.set(true);
    this.dashboard.callNextError.set(null);

    this.queueService
      .callNext(this.dashboard.queueId(), {
        room: formValue.room.trim(),
        provider: formValue.provider.trim(),
      })
      .subscribe({
        next: (response): void => {
          const calledTicket: ServingTicket = {
            queue_entry_id: response.queue_entry_id,
            ticket_number: response.ticket_number,
            status: response.status,
            patient_name: response.patient_name,
            reason_for_visit: response.reason_for_visit,
            called_at: response.called_at,
            grace_expires_at: response.grace_expires_at,
            room_number: response.room_number,
            provider: response.provider,
          };
          this.dashboard.gracePeriodMs.set(response.grace_period_ms);
          this.dashboard.currentTicket.set(calledTicket);
          this.dashboard.waitingCount.update((count: number): number =>
            Math.max(0, count - 1),
          );
          this.dashboard.clearNotice();
          this.dashboard.isCallNextDialogOpen.set(false);
          this.dashboard.loadQueueStatus();
        },
        error: (error: HttpErrorResponse): void => {
          this.logActionError(CALL_NEXT_ERROR, error);
          this.dashboard.callNextError.set(
            this.friendlyQueueError(error, ACTION_FAILED_MESSAGE),
          );
          this.dashboard.isGeneratingQueue.set(false);
          if (error.status === HTTP_CONFLICT) {
            this.dashboard.loadQueueStatus();
          }
        },
        complete: (): void => {
          this.dashboard.isGeneratingQueue.set(false);
        },
      });
  }

  onRecallCurrent(): void {
    if (!this.dashboard.currentTicket()) {
      this.dashboard.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (!this.dashboard.isCalled()) {
      this.dashboard.showNotice(
        'Recall is only available while waiting for the patient.',
        NoticeVariant.INFO,
      );
      return;
    }
    if (this.dashboard.isRecalling()) {
      return;
    }

    this.dashboard.isRecalling.set(true);
    this.queueService.recallCurrent(this.dashboard.queueId()).subscribe({
      next: (): void => {
        this.dashboard.isRecalling.set(false);
      },
      error: (error: HttpErrorResponse): void => {
        this.logActionError(RECALL_ERROR, error);
        this.dashboard.showNotice(ACTION_FAILED_MESSAGE, NoticeVariant.ERROR);
        this.dashboard.isRecalling.set(false);
        if (error.status === HTTP_CONFLICT) {
          this.dashboard.loadQueueStatus();
        }
      },
    });
  }

  // Opens the dialog that doubles as the confirmation for completing.
  onComplete(): void {
    const ticket = this.dashboard.currentTicket();
    if (!ticket) {
      this.dashboard.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (ticket.status !== QueueStatus.IN_CONSULTATION) {
      this.dashboard.showNotice(
        PATIENT_MUST_ARRIVE_MESSAGE,
        NoticeVariant.INFO,
      );
      return;
    }
    this.dashboard.completeTicketNumber.set(ticket.ticket_number);
    this.dashboard.completeNotes.reset('');
    this.dashboard.completeError.set(null);
    this.dashboard.isCompleteDialogOpen.set(true);
  }

  onCancelComplete(): void {
    this.dashboard.isCompleteDialogOpen.set(false);
  }

  onCompleteVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.dashboard.onCancelComplete();
    }
  }

  onConfirmComplete(): void {
    if (this.dashboard.isUpdatingStatus()) {
      return;
    }
    if (!this.dashboard.isInService()) {
      this.onComplete();
      return;
    }
    if (this.dashboard.completeNotes.invalid) {
      this.dashboard.completeNotes.markAsTouched();
      return;
    }

    const notes = this.dashboard.completeNotes.value.trim();
    this.updateCurrentStatus(QueueStatus.COMPLETED, {
      notes: notes || undefined,
      fallbackMessage: COMPLETE_ERROR,
      errorTarget: 'complete-dialog',
    });
  }

  onMarkNoShow(): void {
    const ticket = this.dashboard.currentTicket();
    if (!ticket || !this.dashboard.isCalled()) {
      return;
    }
    this.openStatusDialog(QueueStatus.NO_SHOW, ticket.ticket_number);
  }

  onCancelEntry(): void {
    const ticket = this.dashboard.currentTicket();
    if (
      !ticket ||
      (!this.dashboard.isCalled() && !this.dashboard.isInService())
    ) {
      return;
    }
    this.openStatusDialog(QueueStatus.CANCELLED, ticket.ticket_number);
  }

  private openStatusDialog(
    status: QueueStatus.NO_SHOW | QueueStatus.CANCELLED,
    ticketNumber: string,
  ): void {
    this.dashboard.statusDialogStatus.set(status);
    this.dashboard.statusDialogTicketNumber.set(ticketNumber);
    this.dashboard.statusDialogError.set(null);
    this.dashboard.isStatusDialogOpen.set(true);
  }

  onCancelStatusAction(): void {
    this.dashboard.isStatusDialogOpen.set(false);
    this.dashboard.statusDialogStatus.set(null);
    this.dashboard.statusDialogError.set(null);
  }

  onStatusDialogVisibleChange(isVisible: boolean): void {
    if (!isVisible) {
      this.onCancelStatusAction();
    }
  }

  onConfirmStatusAction(): void {
    const status = this.dashboard.statusDialogStatus();
    if (!status || this.dashboard.isUpdatingStatus()) {
      return;
    }
    this.updateCurrentStatus(status, {
      fallbackMessage:
        status === QueueStatus.NO_SHOW ? NO_SHOW_ERROR : CANCEL_ERROR,
      errorTarget: 'status-dialog',
    });
  }

  private updateCurrentStatus(
    status: QueueStatus,
    options: StatusUpdateOptions,
  ): void {
    const ticket = this.dashboard.currentTicket();
    if (!ticket) {
      this.dashboard.showNotice(NO_CURRENT_TICKET_MESSAGE, NoticeVariant.INFO);
      return;
    }
    if (
      (status === QueueStatus.COMPLETED &&
        ticket.status !== QueueStatus.IN_CONSULTATION) ||
      (status === QueueStatus.IN_CONSULTATION &&
        ticket.status !== QueueStatus.CALLED) ||
      (status === QueueStatus.NO_SHOW &&
        ticket.status !== QueueStatus.CALLED) ||
      (status === QueueStatus.CANCELLED &&
        ticket.status !== QueueStatus.CALLED &&
        ticket.status !== QueueStatus.IN_CONSULTATION)
    ) {
      this.dashboard.showNotice(
        status === QueueStatus.COMPLETED
          ? PATIENT_MUST_ARRIVE_MESSAGE
          : NO_CURRENT_TICKET_MESSAGE,
        NoticeVariant.INFO,
      );
      return;
    }

    this.dashboard.isUpdatingStatus.set(true);
    this.queueService
      .updateEntryStatus(this.dashboard.queueId(), ticket.queue_entry_id, {
        status,
        ...(options.notes ? { notes: options.notes } : {}),
      })
      .subscribe({
        next: (): void => {
          if (status === QueueStatus.COMPLETED) {
            this.dashboard.currentTicket.set(null);
            this.dashboard.completedCount.update(
              (count: number): number => count + 1,
            );
            this.dashboard.isCompleteDialogOpen.set(false);
            this.dashboard.completeNotes.reset('');
            this.dashboard.showNotice(
              `${ticket.ticket_number} consultation completed.`,
              NoticeVariant.SUCCESS,
            );
          } else if (status === QueueStatus.IN_CONSULTATION) {
            this.dashboard.currentTicket.update((current) =>
              current
                ? {
                    ...current,
                    status: QueueStatus.IN_CONSULTATION,
                    grace_expires_at: null,
                  }
                : null,
            );
            this.dashboard.expirationRequestEntryId = null;
          } else if (status === QueueStatus.NO_SHOW) {
            this.dashboard.currentTicket.set(null);
            this.dashboard.noShowCount.update(
              (count: number): number => count + 1,
            );
            this.dashboard.showNotice(
              `${ticket.ticket_number} was marked as no-show.`,
              NoticeVariant.WARNING,
            );
            this.dashboard.expirationRequestEntryId = null;
            this.dashboard.isStatusDialogOpen.set(false);
            this.dashboard.statusDialogStatus.set(null);
            this.dashboard.completeNotes.reset('');
          } else if (status === QueueStatus.CANCELLED) {
            this.dashboard.currentTicket.set(null);
            this.dashboard.showNotice(
              `${ticket.ticket_number} was cancelled.`,
              NoticeVariant.INFO,
            );
            this.dashboard.isStatusDialogOpen.set(false);
            this.dashboard.statusDialogStatus.set(null);
            this.dashboard.completeNotes.reset('');
          }
          this.dashboard.completeError.set(null);
          this.dashboard.statusDialogError.set(null);
          this.dashboard.isUpdatingStatus.set(false);
          this.dashboard.loadQueueStatus();
        },
        error: (error: HttpErrorResponse): void => {
          this.logActionError(options.fallbackMessage, error);
          if (
            status === QueueStatus.NO_SHOW &&
            error.status === HTTP_CONFLICT &&
            options.errorTarget === 'page'
          ) {
            this.dashboard.expirationRequestEntryId = null;
            this.dashboard.isUpdatingStatus.set(false);
            this.dashboard.loadQueueStatus();
            return;
          }
          if (options.errorTarget === 'complete-dialog') {
            this.dashboard.completeError.set(
              this.friendlyQueueError(error, ACTION_FAILED_MESSAGE),
            );
          } else if (options.errorTarget === 'status-dialog') {
            this.dashboard.statusDialogError.set(
              this.friendlyQueueError(error, ACTION_FAILED_MESSAGE),
            );
          } else {
            this.dashboard.showNotice(
              this.friendlyQueueError(error, ACTION_FAILED_MESSAGE),
              NoticeVariant.ERROR,
            );
          }
          this.dashboard.isUpdatingStatus.set(false);
          if (status === QueueStatus.NO_SHOW) {
            this.dashboard.expirationRequestEntryId = null;
          }
          if (error.status === HTTP_CONFLICT) {
            this.dashboard.loadQueueStatus();
          }
        },
      });
  }

  private logActionError(message: string, error: HttpErrorResponse): void {
    console.error(message, error);
  }

  private friendlyQueueError(
    error: HttpErrorResponse,
    fallbackMessage: string,
  ): string {
    const body = error.error as { code?: unknown } | null;
    switch (body?.code) {
      case 'QUEUE_EMPTY':
        return QUEUE_EMPTY_MESSAGE;
      case 'STATION_BUSY':
        return STATION_BUSY_MESSAGE;
      case 'ALREADY_CALLED':
        return ALREADY_CALLED_MESSAGE;
      case 'INVALID_TRANSITION':
        return INVALID_TRANSITION_MESSAGE;
      default:
        return fallbackMessage;
    }
  }
}

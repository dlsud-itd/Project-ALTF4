import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { QueueService, AppConfirmService } from '@core/services';
import { QueueStatus, WalkInRequest, WalkInResponse } from '@core/models';

const NAME_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 60;
const REASON_MAX_LENGTH = 200;
const FALLBACK_ERROR = 'Could not create the walk-in ticket.';

// TODO(Lim, Jereign): replace with the active queue id for today
const QUEUE_ID = 1;

type IssuedWalkInTicket = {
  ticketNumber: string;
  patientName: string;
  visitReason: string;
  issuedAt: string;
  status: QueueStatus;
};

// Staff page for creating on-site walk-in tickets.
@Component({
  selector: 'app-staff-walk-in',
  standalone: true,
  imports: [Button, DatePipe, ReactiveFormsModule],
  templateUrl: './staff-walk-in.component.html',
  styleUrl: './staff-walk-in.component.scss',
})
export class StaffWalkInComponent {
  readonly QueueStatus = QueueStatus;
  private readonly queueService = inject(QueueService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly confirmService = inject(AppConfirmService);
  private readonly validatePatientName = (
    control: AbstractControl<string>,
  ): ValidationErrors | null => {
    const name = control.value.trim().replace(/\s+/g, ' ');
    if (name.length < NAME_MIN_LENGTH) {
      return { minlength: true };
    }
    if (name.length > NAME_MAX_LENGTH) {
      return { maxlength: true };
    }
    return NAME_PATTERN.test(name) ? null : { pattern: true };
  };

  readonly queueId = signal<number>(QUEUE_ID);
  readonly issuedTicket = signal<IssuedWalkInTicket | null>(null);
  readonly isGeneratingQueue = signal<boolean>(false);
  readonly walkInError = signal<string | null>(null);
  readonly walkInForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, this.validatePatientName]],
    reasonForVisit: ['', [Validators.maxLength(REASON_MAX_LENGTH)]],
  });

  onGenerateQueueNumber(): void {
    if (this.walkInForm.invalid) {
      this.walkInForm.markAllAsTouched();
      return;
    }

    const formValue = this.walkInForm.getRawValue();
    const payload: WalkInRequest = {
      name: formValue.name.trim().replace(/\s+/g, ' '),
      reasonForVisit: formValue.reasonForVisit.trim() || undefined,
    };

    this.confirmService.confirmReview({
      header: 'Issue Walk-in Ticket',
      message: `Issue a new queue ticket for patient "${payload.name}"?`,
      acceptLabel: 'Issue Ticket',
      rejectLabel: 'Review',
      accept: () => this.executeGenerateTicket(payload),
    });
  }

  private executeGenerateTicket(payload: WalkInRequest): void {
    this.issuedTicket.set(null);
    this.isGeneratingQueue.set(true);
    this.walkInError.set(null);
    this.queueService
      .generateStaffQueueNumber(this.queueId(), payload)
      .subscribe({
        next: (response: WalkInResponse): void => {
          this.issuedTicket.set({
            ticketNumber: response.ticket_number,
            patientName: payload.name,
            visitReason: payload.reasonForVisit ?? '',
            issuedAt: response.joined_at,
            status: response.status,
          });
          this.walkInForm.reset();
        },
        error: (error: { error?: { message?: string | string[] } }): void => {
          const message = error.error?.message;
          this.walkInError.set(
            Array.isArray(message)
              ? message.join(', ')
              : (message ?? FALLBACK_ERROR),
          );
          this.isGeneratingQueue.set(false);
        },
        complete: (): void => {
          this.isGeneratingQueue.set(false);
        },
      });
  }

  onNewWalkIn(): void {
    this.issuedTicket.set(null);
    this.walkInError.set(null);
    this.walkInForm.reset();
  }
}

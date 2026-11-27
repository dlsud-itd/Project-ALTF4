import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import {
  normalizePhMobile,
  phMobileValidator,
  requiredTextValidator,
} from '@core/utils';

const NAME_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 60;
const REASON_MAX_LENGTH = 200;
const FALLBACK_ERROR = 'Could not create the walk-in ticket.';

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
export class StaffWalkInComponent implements OnInit {
  readonly QueueStatus = QueueStatus;
  private readonly queueService = inject(QueueService);
  private readonly destroyRef = inject(DestroyRef);
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

  readonly queueId = signal<number | null>(null);
  readonly isLoadingQueue = signal(true);
  readonly queueError = signal<string | null>(null);
  readonly issuedTicket = signal<IssuedWalkInTicket | null>(null);
  readonly isGeneratingQueue = signal<boolean>(false);
  readonly walkInError = signal<string | null>(null);
  readonly walkInForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, this.validatePatientName]],
    phoneNumber: [
      '',
      [Validators.required, phMobileValidator, Validators.maxLength(30)],
    ],
    reasonForVisit: [
      '',
      [requiredTextValidator, Validators.maxLength(REASON_MAX_LENGTH)],
    ],
  });

  ngOnInit(): void {
    this.loadQueue();
  }

  loadQueue(): void {
    this.isLoadingQueue.set(true);
    this.queueError.set(null);
    this.queueService
      .getTodayQueue()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (todayQueue): void => {
          this.queueId.set(todayQueue.id);
          this.isLoadingQueue.set(false);
        },
        error: (): void => {
          this.queueId.set(null);
          this.isLoadingQueue.set(false);
          this.queueError.set("Could not load today's queue. Please try again.");
        },
      });
  }

  onGenerateQueueNumber(): void {
    if (this.walkInForm.invalid) {
      this.walkInForm.markAllAsTouched();
      return;
    }
    const queueId = this.queueId();
    if (queueId === null) {
      this.queueError.set("Today's queue is not available yet.");
      return;
    }

    const formValue = this.walkInForm.getRawValue();
    const payload: WalkInRequest = {
      name: formValue.name.trim().replace(/\s+/g, ' '),
      phoneNumber: normalizePhMobile(formValue.phoneNumber),
      reasonForVisit: formValue.reasonForVisit.trim(),
    };

    this.confirmService.confirmReview({
      header: 'Issue Walk-in Ticket',
      message: `Issue a new queue ticket for patient "${payload.name}"?`,
      acceptLabel: 'Issue Ticket',
      rejectLabel: 'Review',
      accept: () => this.executeGenerateTicket(queueId, payload),
    });
  }

  private executeGenerateTicket(queueId: number, payload: WalkInRequest): void {
    this.issuedTicket.set(null);
    this.isGeneratingQueue.set(true);
    this.walkInError.set(null);
    this.queueService
      .generateStaffQueueNumber(queueId, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: WalkInResponse): void => {
          this.issuedTicket.set({
            ticketNumber: response.ticket_number,
            patientName: payload.name,
            visitReason: payload.reasonForVisit,
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

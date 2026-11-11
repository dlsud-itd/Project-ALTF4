import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import QRCode from 'qrcode';
import { Button } from 'primeng/button';
import { QueueService } from '@core/services';
import { WalkInRequest } from '@core/models';

const NAME_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 60;
const REASON_MAX_LENGTH = 200;
const QR_MARGIN = 1;
const QR_WIDTH = 180;
const QR_DARK_COLOR = '#0d4e52';
const QR_LIGHT_COLOR = '#ffffff';
const PRINT_START_DELAY_MS = 50;
const TITLE_RESTORE_DELAY_MS = 200;
const FALLBACK_ERROR = 'Could not create the walk-in ticket.';
const FALLBACK_ORIGIN = 'http://localhost:4200';

// TODO(Lim, Jereign): replace with the active queue id for today
const QUEUE_ID = 1;

// Staff page for creating on-site walk-in tickets with a tracking QR code.
@Component({
  selector: 'app-staff-walk-in',
  standalone: true,
  imports: [Button, ReactiveFormsModule],
  templateUrl: './staff-walk-in.component.html',
  styleUrl: './staff-walk-in.component.scss',
})
export class StaffWalkInComponent {
  private readonly queueService = inject(QueueService);
  private readonly formBuilder = inject(FormBuilder);
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
  readonly generatedTicket = signal<string | null>(null);
  readonly qrCodeDataUrl = signal<string | null>(null);
  readonly isGeneratingQueue = signal<boolean>(false);
  readonly walkInError = signal<string | null>(null);
  readonly walkInForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, this.validatePatientName]],
    reasonForVisit: ['', [Validators.maxLength(REASON_MAX_LENGTH)]],
  });

  private getTrackingUrl(token: string): string {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : FALLBACK_ORIGIN;
    return `${origin}/patient/queue?token=${encodeURIComponent(token)}`;
  }

  private async generateQrCode(token: string): Promise<void> {
    try {
      const dataUrl = await QRCode.toDataURL(this.getTrackingUrl(token), {
        margin: QR_MARGIN,
        width: QR_WIDTH,
        color: { dark: QR_DARK_COLOR, light: QR_LIGHT_COLOR },
      });
      this.qrCodeDataUrl.set(dataUrl);
    } catch {
      this.qrCodeDataUrl.set(null);
    }
  }

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

    this.isGeneratingQueue.set(true);
    this.walkInError.set(null);
    this.queueService
      .generateStaffQueueNumber(this.queueId(), payload)
      .subscribe({
        next: (response): void => {
          this.generatedTicket.set(response.ticket_number);
          this.qrCodeDataUrl.set(null);

          if (response.tracking_token) {
            void this.generateQrCode(response.tracking_token);
          }

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

  onPrintQueueTicket(): void {
    if (!this.generatedTicket()) {
      return;
    }

    const originalTitle = document.title;
    document.title = `ClinicQueue Ticket ${this.generatedTicket()}`;

    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = originalTitle;
      }, TITLE_RESTORE_DELAY_MS);
    }, PRINT_START_DELAY_MS);
  }
}

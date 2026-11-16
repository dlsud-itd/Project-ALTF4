import { Injectable, inject } from '@angular/core';
import { ConfirmationService, Confirmation } from 'primeng/api';

export type ConfirmActionOptions = {
  header: string;
  message: string;
  acceptLabel?: string;
  rejectLabel?: string;
  icon?: string;
  accept: () => void;
  reject?: () => void;
};

@Injectable({
  providedIn: 'root',
})
export class AppConfirmService {
  private readonly confirmationService = inject(ConfirmationService);

  // Destructive actions such as deleting slots, cancelling appointments, or forfeiting queue tickets.
  confirmDestructive(options: ConfirmActionOptions): void {
    this.confirmationService.confirm({
      header: options.header,
      message: options.message,
      icon: options.icon ?? 'pi pi-exclamation-triangle',
      acceptLabel: options.acceptLabel ?? 'Yes, Confirm',
      rejectLabel: options.rejectLabel ?? 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: options.accept,
      reject: options.reject,
    });
  }

  // Warning for consequential state changes such as marking no-show or disabling active slots.
  confirmWarning(options: ConfirmActionOptions): void {
    this.confirmationService.confirm({
      header: options.header,
      message: options.message,
      icon: options.icon ?? 'pi pi-exclamation-circle',
      acceptLabel: options.acceptLabel ?? 'Proceed',
      rejectLabel: options.rejectLabel ?? 'Cancel',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: options.accept,
      reject: options.reject,
    });
  }

  // Review confirmation modal before submitting irreversible submissions such as booking an appointment.
  confirmReview(options: ConfirmActionOptions): void {
    this.confirmationService.confirm({
      header: options.header,
      message: options.message,
      icon: options.icon ?? 'pi pi-info-circle',
      acceptLabel: options.acceptLabel ?? 'Confirm & Submit',
      rejectLabel: options.rejectLabel ?? 'Review Details',
      acceptButtonProps: { severity: 'primary' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: options.accept,
      reject: options.reject,
    });
  }

  // General pass-through for custom confirmation scenarios.
  confirm(confirmation: Confirmation): void {
    this.confirmationService.confirm(confirmation);
  }
}


import { Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { QueueStatus } from '@core/models';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';

type CallNextForm = FormGroup<{
  room: FormControl<string>;
  provider: FormControl<string>;
}>;

@Component({
  selector: 'app-staff-dashboard-dialogs',
  standalone: true,
  imports: [Button, Dialog, Message, ReactiveFormsModule],
  templateUrl: './staff-dashboard-dialogs.component.html',
  styleUrl: './staff-dashboard-dialogs.component.scss',
})
export class StaffDashboardDialogsComponent {
  readonly QueueStatus = QueueStatus;
  readonly callNextForm = input.required<CallNextForm>();
  readonly completeNotes = input.required<FormControl<string>>();
  readonly isGeneratingQueue = input.required<boolean>();
  readonly isUpdatingStatus = input.required<boolean>();
  readonly isCallNextDialogOpen = input.required<boolean>();
  readonly isCompleteDialogOpen = input.required<boolean>();
  readonly isStatusDialogOpen = input.required<boolean>();
  readonly statusDialogStatus = input.required<
    QueueStatus.NO_SHOW | QueueStatus.CANCELLED | null
  >();
  readonly statusDialogError = input.required<string | null>();
  readonly statusDialogTicketNumber = input.required<string>();
  readonly callNextError = input.required<string | null>();
  readonly completeError = input.required<string | null>();
  readonly completeTicketNumber = input.required<string>();
  readonly roomMaxLength = input.required<number>();
  readonly providerMaxLength = input.required<number>();
  readonly notesMaxLength = input.required<number>();

  readonly callNextVisibleChange = output<boolean>();
  readonly cancelCallNext = output<void>();
  readonly confirmCallNext = output<void>();
  readonly completeVisibleChange = output<boolean>();
  readonly cancelComplete = output<void>();
  readonly confirmComplete = output<void>();
  readonly statusDialogVisibleChange = output<boolean>();
  readonly cancelStatusAction = output<void>();
  readonly confirmStatusAction = output<void>();

  onCallNextVisibleChange(isVisible: boolean): void {
    this.callNextVisibleChange.emit(isVisible);
  }

  onCancelCallNext(): void {
    this.cancelCallNext.emit();
  }

  onConfirmCallNext(): void {
    this.confirmCallNext.emit();
  }

  onCompleteVisibleChange(isVisible: boolean): void {
    this.completeVisibleChange.emit(isVisible);
  }

  onCancelComplete(): void {
    this.cancelComplete.emit();
  }

  onConfirmComplete(): void {
    this.confirmComplete.emit();
  }

  onStatusDialogVisibleChange(isVisible: boolean): void {
    this.statusDialogVisibleChange.emit(isVisible);
  }

  onCancelStatusAction(): void {
    this.cancelStatusAction.emit();
  }

  onConfirmStatusAction(): void {
    this.confirmStatusAction.emit();
  }
}

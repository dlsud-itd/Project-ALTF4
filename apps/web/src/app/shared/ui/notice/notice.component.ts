import { Component, input, output } from '@angular/core';

export enum NoticeVariant {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

@Component({
  selector: 'app-notice',
  standalone: true,
  templateUrl: './notice.component.html',
  styleUrl: './notice.component.scss',
  host: {
    '[class.notice-visible]': 'message() !== null',
    '[attr.aria-hidden]': 'message() === null',
  },
})
export class NoticeComponent {
  readonly message = input<string | null>(null);
  readonly variant = input<NoticeVariant>(NoticeVariant.INFO);
  readonly dismiss = output<void>();

  readonly NoticeVariant = NoticeVariant;

  onDismiss(): void {
    this.dismiss.emit();
  }
}

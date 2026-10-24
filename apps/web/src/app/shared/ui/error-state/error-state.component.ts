import { Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';

const DEFAULT_TITLE = 'Something went wrong';
const DEFAULT_MESSAGE = 'Please try again in a moment.';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [Button],
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
})
export class ErrorStateComponent {
  readonly title = input<string>(DEFAULT_TITLE);
  readonly message = input<string>(DEFAULT_MESSAGE);
  readonly retry = output<void>();

  onRetry(): void {
    this.retry.emit();
  }
}
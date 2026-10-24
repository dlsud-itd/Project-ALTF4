import { Component, input } from '@angular/core';

const DEFAULT_ICON = 'pi-inbox';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly icon = input<string>(DEFAULT_ICON);
}
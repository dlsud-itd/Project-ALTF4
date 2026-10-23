import { Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-card',
  standalone: true,
  template: `
    <section class="card">
      <h2 class="card-title">{{ title() }}</h2>
      <ng-content></ng-content>
    </section>
  `,
  styles: `
    .card {
      padding: 20px; background: #fff; border: 1px solid var(--surface-200);
      border-radius: 12px; box-shadow: var(--box-shadow);
    }
    .card-title { margin-bottom: 14px; font-size: 1rem; font-weight: 700; color: var(--text-main); }
  `,
})
export class AuthCardComponent {
  readonly title = input.required<string>();
}
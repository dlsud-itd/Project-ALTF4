import { Component } from '@angular/core';

@Component({
  selector: 'app-auth-brand',
  standalone: true,
  template: `
    <div class="brand">
      <span class="brand-logo"><i class="pi pi-truck"></i></span>
      <h1 class="brand-name">ClinicQueue</h1>
      <p class="brand-tagline">University Health Services</p>
    </div>
  `,
  styles: `
    .brand { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .brand-logo {
      display: flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; border-radius: 12px;
      background: var(--auth-primary); color: #fff; font-size: 1.5rem;
    }
    .brand-name { margin-top: 8px; font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
    .brand-tagline { color: var(--text-muted); font-size: 0.875rem; }
  `,
})
export class AuthBrandComponent {}
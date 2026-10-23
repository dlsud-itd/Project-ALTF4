import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [Button, RouterLink],
  templateUrl: './staff-dashboard.component.html',
  styleUrl: './staff-dashboard.component.scss',
})
export class StaffDashboardComponent {
  readonly staffName = signal<string>('Staff Nurse');
  readonly counterNumber = signal<number>(1);
  readonly servingTicket = signal<string>('A-104');
  readonly waitingCount = signal<number>(5);
  readonly completedCount = signal<number>(18);

  onCallNext(): void {
    if (this.waitingCount() > 0) {
      this.waitingCount.update((count) => count - 1);
      const nextNum = parseInt(this.servingTicket().replace('A-', ''), 10) + 1;
      this.servingTicket.set(`A-${nextNum}`);
    }
  }

  onComplete(): void {
    this.completedCount.update((c) => c + 1);
  }
}

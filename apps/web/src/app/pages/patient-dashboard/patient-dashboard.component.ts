import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [Button, RouterLink],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
})
export class PatientDashboardComponent {
  readonly patientName = signal<string>('Juan Dela Cruz');
  readonly currentTicket = signal<string | null>(null);
  readonly nowServingTicket = signal<string>('A-104');

  onJoinQueue(): void {
    this.currentTicket.set('A-108');
  }

  onLeaveQueue(): void {
    this.currentTicket.set(null);
  }
}

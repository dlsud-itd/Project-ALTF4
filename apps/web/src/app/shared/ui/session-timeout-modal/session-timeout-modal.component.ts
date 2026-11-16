import { Component, inject } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { SessionTimeoutService } from '@core/services';

@Component({
  selector: 'app-session-timeout-modal',
  standalone: true,
  imports: [Dialog, Button],
  templateUrl: './session-timeout-modal.component.html',
  styleUrl: './session-timeout-modal.component.scss',
})
export class SessionTimeoutModalComponent {
  readonly timeoutService = inject(SessionTimeoutService);

  onStaySignedIn(): void {
    this.timeoutService.staySignedIn();
  }

  onSignOut(): void {
    this.timeoutService.forceLogout('timeout');
  }
}


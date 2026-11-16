import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { AuthService, SessionTimeoutService } from '@core/services';
import { SessionTimeoutModalComponent } from '@shared/ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialog, SessionTimeoutModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly sessionTimeoutService = inject(SessionTimeoutService);

  constructor() {
    // Automatically start inactivity monitoring when user is authenticated, and stop when logged out.
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.sessionTimeoutService.startMonitoring();
      } else {
        this.sessionTimeoutService.stopMonitoring();
      }
    });
  }
}

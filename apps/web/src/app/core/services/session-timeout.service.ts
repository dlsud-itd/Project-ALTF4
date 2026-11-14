import {
  Injectable,
  NgZone,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { SseService } from './sse.service';

// 14 minutes of inactivity before the warning modal is shown
export const DEFAULT_IDLE_TIMEOUT_MS = 14 * 60 * 1000;
// 60-second warning countdown before forced logout
export const DEFAULT_COUNTDOWN_SECONDS = 60;
// Activity events throttled to once every 2 seconds outside Angular zone
const ACTIVITY_THROTTLE_MS = 2000;

@Injectable({
  providedIn: 'root',
})
export class SessionTimeoutService {
  private readonly authService = inject(AuthService);
  private readonly sseService = inject(SseService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
  private warningCountdownSeconds = DEFAULT_COUNTDOWN_SECONDS;

  private idleTimerSubscription: Subscription | null = null;
  private countdownSubscription: Subscription | null = null;
  private activitySubscription: Subscription | null = null;
  private isTracking = false;

  readonly isWarningVisible = signal<boolean>(false);
  readonly secondsRemaining = signal<number>(DEFAULT_COUNTDOWN_SECONDS);

  constructor() {
    this.destroyRef.onDestroy(() => this.cleanup());
    this.initCrossTabSync();
  }

  // Configures custom timeouts (useful for testing or role-specific policies).
  setTimeouts(idleMs: number, countdownSeconds: number): void {
    this.idleTimeoutMs = idleMs;
    this.warningCountdownSeconds = countdownSeconds;
    this.secondsRemaining.set(countdownSeconds);
    if (this.isTracking) {
      this.restartIdleTimer();
    }
  }

  // Begins tracking user activity if the user is authenticated.
  startMonitoring(): void {
    if (typeof window === 'undefined') {
      return;
    }
    // Clean up any stale state first and reset to default timeout thresholds
    this.cleanup();
    this.isTracking = true;
    this.listenToUserActivity();
    this.restartIdleTimer();
  }

  // Stops all timers and removes event listeners.
  stopMonitoring(): void {
    this.cleanup();
  }

  // Extends the session when the user clicks "Stay Signed In".
  staySignedIn(): void {
    this.ngZone.run(() => {
      this.isWarningVisible.set(false);
      this.secondsRemaining.set(this.warningCountdownSeconds);
      this.clearCountdown();
      this.restartIdleTimer();
      // Verify token validity in background
      this.authService.getProfile().subscribe({
        error: () => this.forceLogout('session_terminated'),
      });
    });
  }

  // Executes forced logout when timeout reaches zero.
  forceLogout(reason: 'timeout' | 'session_terminated' = 'timeout'): void {
    this.ngZone.run(() => {
      this.cleanup();
      this.sseService.disconnect();
      this.authService.logout().subscribe({
        complete: () => {
          void this.router.navigate(['/login'], {
            queryParams: { reason },
          });
        },
      });
    });
  }

  // Resets the inactivity timer upon detected user interaction.
  private onUserActivity(): void {
    if (this.isWarningVisible()) {
      return;
    }
    this.restartIdleTimer();
  }

  // Binds high-frequency DOM activity events outside Angular zone to eliminate change detection overhead.
  private listenToUserActivity(): void {
    this.clearActivity();
    this.ngZone.runOutsideAngular(() => {
      const activityEvents$ = merge(
        fromEvent(window, 'mousemove'),
        fromEvent(window, 'mousedown'),
        fromEvent(window, 'keydown'),
        fromEvent(window, 'touchstart'),
        fromEvent(window, 'scroll'),
      ).pipe(
        throttleTime(ACTIVITY_THROTTLE_MS),
        takeUntilDestroyed(this.destroyRef),
      );

      this.activitySubscription = activityEvents$.subscribe(() =>
        this.onUserActivity(),
      );
    });
  }

  // Restarts the idle countdown timer.
  private restartIdleTimer(): void {
    this.clearIdleTimer();
    this.ngZone.runOutsideAngular(() => {
      this.idleTimerSubscription = timer(this.idleTimeoutMs).subscribe(() => {
        this.showWarning();
      });
    });
  }

  // Enters Angular zone and opens the countdown warning modal.
  private showWarning(): void {
    this.ngZone.run(() => {
      this.secondsRemaining.set(this.warningCountdownSeconds);
      this.isWarningVisible.set(true);
      this.startCountdown();
    });
  }

  // Starts the 1-second interval countdown for the warning modal.
  private startCountdown(): void {
    this.clearCountdown();
    this.countdownSubscription = timer(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const remaining = this.secondsRemaining() - 1;
        if (remaining <= 0) {
          this.secondsRemaining.set(0);
          this.clearCountdown();
          this.forceLogout('timeout');
        } else {
          this.secondsRemaining.set(remaining);
        }
      });
  }

  // Synchronizes session termination across multiple browser tabs via storage events.
  private initCrossTabSync(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === 'clinicqueue_token' && !event.newValue) {
        // Token was cleared in another tab (e.g. user logged out)
        this.ngZone.run(() => {
          this.cleanup();
          this.authService.clearSession();
          void this.router.navigate(['/login'], {
            queryParams: { reason: 'session_terminated' },
          });
        });
      }
    });
  }

  private clearIdleTimer(): void {
    if (this.idleTimerSubscription) {
      this.idleTimerSubscription.unsubscribe();
      this.idleTimerSubscription = null;
    }
  }

  private clearCountdown(): void {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = null;
    }
  }

  private clearActivity(): void {
    if (this.activitySubscription) {
      this.activitySubscription.unsubscribe();
      this.activitySubscription = null;
    }
  }

  private cleanup(): void {
    this.isTracking = false;
    this.clearIdleTimer();
    this.clearCountdown();
    this.clearActivity();
    this.isWarningVisible.set(false);
    this.idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
    this.warningCountdownSeconds = DEFAULT_COUNTDOWN_SECONDS;
    this.secondsRemaining.set(DEFAULT_COUNTDOWN_SECONDS);
  }
}

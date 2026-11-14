import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SseService } from './sse.service';
import {
  SessionTimeoutService,
} from './session-timeout.service';

describe('SessionTimeoutService', () => {
  let service: SessionTimeoutService;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let sseServiceSpy: jasmine.SpyObj<SseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'logout',
      'clearSession',
      'getProfile',
    ]);
    authServiceSpy.logout.and.returnValue(of(undefined));
    authServiceSpy.getProfile.and.returnValue(of({} as any));

    sseServiceSpy = jasmine.createSpyObj('SseService', ['disconnect']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        SessionTimeoutService,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: SseService, useValue: sseServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(SessionTimeoutService);
  });

  afterEach(() => {
    service.stopMonitoring();
  });

  it('should be created with initial closed state', () => {
    expect(service).toBeTruthy();
    expect(service.isWarningVisible()).toBeFalse();
    expect(service.secondsRemaining()).toBe(60);
  });

  it('triggers warning modal when idle timeout elapsed', fakeAsync(() => {
    service.setTimeouts(5000, 10);
    service.startMonitoring();

    expect(service.isWarningVisible()).toBeFalse();

    // Advance 5 seconds (idle timeout)
    tick(5000);

    expect(service.isWarningVisible()).toBeTrue();
    expect(service.secondsRemaining()).toBe(10);

    // Stop to clean up timers
    service.stopMonitoring();
  }));

  it('counts down and executes forceLogout when countdown reaches zero', fakeAsync(() => {
    service.setTimeouts(3000, 3);
    service.startMonitoring();

    // Trigger warning
    tick(3000);
    expect(service.isWarningVisible()).toBeTrue();

    // Tick countdown: 3 -> 2 -> 1 -> 0
    tick(1000);
    expect(service.secondsRemaining()).toBe(2);

    tick(1000);
    expect(service.secondsRemaining()).toBe(1);

    tick(1000);
    expect(service.secondsRemaining()).toBe(0);

    // Verifies logout was called
    expect(sseServiceSpy.disconnect).toHaveBeenCalled();
    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'timeout' },
    });
  }));

  it('resets idle timer and hides warning when user clicks staySignedIn', fakeAsync(() => {
    service.setTimeouts(5000, 10);
    service.startMonitoring();

    tick(5000);
    expect(service.isWarningVisible()).toBeTrue();

    service.staySignedIn();

    expect(service.isWarningVisible()).toBeFalse();
    expect(service.secondsRemaining()).toBe(10);
    expect(authServiceSpy.getProfile).toHaveBeenCalled();

    // Verify it doesn't immediately log out
    tick(3000);
    expect(service.isWarningVisible()).toBeFalse();

    service.stopMonitoring();
  }));

  it('logs out immediately if staySignedIn fails token verification', fakeAsync(() => {
    authServiceSpy.getProfile.and.returnValue(
      throwError(() => new Error('401 Unauthorized')),
    );
    service.setTimeouts(5000, 10);
    service.startMonitoring();

    tick(5000);
    expect(service.isWarningVisible()).toBeTrue();

    service.staySignedIn();

    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'session_terminated' },
    });
  }));

  it('resets timeout thresholds back to defaults on cleanup and monitoring start', () => {
    service.setTimeouts(2000, 5);
    expect(service.secondsRemaining()).toBe(5);

    service.stopMonitoring();
    expect(service.secondsRemaining()).toBe(60);

    service.startMonitoring();
    expect(service.isWarningVisible()).toBeFalse();
    expect(service.secondsRemaining()).toBe(60);
  });

  it('clears session and redirects on storage event from another tab', () => {
    const storageEvent = new StorageEvent('storage', {
      key: 'clinicqueue_token',
      newValue: null,
      oldValue: 'some-token',
    });
    window.dispatchEvent(storageEvent);

    expect(authServiceSpy.clearSession).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'session_terminated' },
    });
  });
});


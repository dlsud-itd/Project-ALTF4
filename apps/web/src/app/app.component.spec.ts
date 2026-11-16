import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { AuthService, SessionTimeoutService } from '@core/services';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let authServiceSpy: { currentUser: ReturnType<typeof signal<any>> };
  let sessionTimeoutServiceSpy: jasmine.SpyObj<SessionTimeoutService>;

  beforeEach(async () => {
    authServiceSpy = {
      currentUser: signal(null),
    };
    sessionTimeoutServiceSpy = jasmine.createSpyObj(
      'SessionTimeoutService',
      ['startMonitoring', 'stopMonitoring'],
      {
        isWarningVisible: signal(false),
        secondsRemaining: signal(60),
      },
    );

    await TestBed.configureTestingModule({
      imports: [AppComponent, NoopAnimationsModule],
      providers: [
        ConfirmationService,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: SessionTimeoutService, useValue: sessionTimeoutServiceSpy },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('starts session monitoring when user logs in and stops when logged out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(sessionTimeoutServiceSpy.stopMonitoring).toHaveBeenCalled();

    authServiceSpy.currentUser.set({ id: 1, fullName: 'Test User' });
    TestBed.flushEffects();

    expect(sessionTimeoutServiceSpy.startMonitoring).toHaveBeenCalled();

    authServiceSpy.currentUser.set(null);
    TestBed.flushEffects();

    expect(sessionTimeoutServiceSpy.stopMonitoring).toHaveBeenCalled();
  });
});

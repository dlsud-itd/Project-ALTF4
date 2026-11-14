import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SessionTimeoutService } from '@core/services';
import { SessionTimeoutModalComponent } from './session-timeout-modal.component';

describe('SessionTimeoutModalComponent', () => {
  let component: SessionTimeoutModalComponent;
  let fixture: ComponentFixture<SessionTimeoutModalComponent>;
  let timeoutServiceMock: {
    isWarningVisible: ReturnType<typeof signal<boolean>>;
    secondsRemaining: ReturnType<typeof signal<number>>;
    staySignedIn: jasmine.Spy;
    forceLogout: jasmine.Spy;
  };

  beforeEach(async () => {
    timeoutServiceMock = {
      isWarningVisible: signal(true),
      secondsRemaining: signal(45),
      staySignedIn: jasmine.createSpy('staySignedIn'),
      forceLogout: jasmine.createSpy('forceLogout'),
    };

    await TestBed.configureTestingModule({
      imports: [SessionTimeoutModalComponent, NoopAnimationsModule],
      providers: [
        { provide: SessionTimeoutService, useValue: timeoutServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionTimeoutModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('delegates stay signed in action to service', () => {
    component.onStaySignedIn();
    expect(timeoutServiceMock.staySignedIn).toHaveBeenCalled();
  });

  it('delegates sign out action to service with timeout reason', () => {
    component.onSignOut();
    expect(timeoutServiceMock.forceLogout).toHaveBeenCalledWith('timeout');
  });
});


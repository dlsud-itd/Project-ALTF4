import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { LoginResponse } from '@core/models';
import { AuthService } from '@core/services';
import { LoginComponent } from './login.component';

const HTTP_UNAUTHORIZED = 401;

const staffResponse: LoginResponse = {
  message: 'Login successful',
  userId: 1,
  role: 'staff',
  accessToken: 'test-token',
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: AuthService;
  let navigateByUrlSpy: jasmine.Spy;

  const setup = (queryParams: Record<string, string> = {}): void => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(queryParams) },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    navigateByUrlSpy = spyOn(
      TestBed.inject(Router),
      'navigateByUrl',
    ).and.resolveTo(true);
    fixture.detectChanges();
  };

  const signIn = (result$: Observable<LoginResponse>): void => {
    spyOn(authService, 'login').and.returnValue(result$);
    component.form.patchValue({
      email: 'nurse@clinicqueue.internal',
      password: 'secret123',
    });
    component.onSubmit();
  };

  it('should create', () => {
    setup();

    expect(component).toBeTruthy();
  });

  it('should flag an inactive account from the query string', () => {
    setup({ error: 'inactive' });

    expect(component.accountInactive).toBeTrue();
  });

  it('should not call the API when the form is invalid', () => {
    setup();
    const loginSpy = spyOn(authService, 'login');

    component.onSubmit();

    expect(loginSpy).not.toHaveBeenCalled();
    expect(component.showError('email')).toBeTrue();
  });

  it('should go to the role home when there is no return url', () => {
    setup();

    signIn(of(staffResponse));

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/staff');
  });

  it('should go to a safe return url', () => {
    setup({ returnUrl: '/patient/appointments' });

    signIn(of(staffResponse));

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/patient/appointments');
  });

  it('should ignore an unsafe return url', () => {
    setup({ returnUrl: 'https://evil.example' });

    signIn(of(staffResponse));

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/staff');
  });

  it('should show the server message when sign in fails', () => {
    setup();
    const error = new HttpErrorResponse({
      status: HTTP_UNAUTHORIZED,
      error: { message: 'Invalid email or password' },
    });

    signIn(throwError(() => error));

    expect(component.loading()).toBeFalse();
    expect(component.errorMessage()).toBe('Invalid email or password');
  });
});
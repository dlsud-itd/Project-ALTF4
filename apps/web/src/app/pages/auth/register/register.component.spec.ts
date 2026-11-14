import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClinicAffiliation, RegisterResponse } from '@core/models';
import { AuthService } from '@core/services';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: AuthService;
  let router: Router;

  const validFormValues = {
    firstName: 'Juan',
    middleName: 'Protacio',
    lastName: 'Dela Cruz',
    email: 'juan@dlsud.edu.ph',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    affiliation: ClinicAffiliation.STUDENT,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create the registration component', () => {
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
    it('should initialize with an invalid empty form', () => {
      expect(component.form.valid).toBeFalse();
    });

    it('should require firstName, lastName, email, password, and confirmPassword', () => {
      const { firstName, lastName, email, password, confirmPassword } =
        component.form.controls;

      expect(firstName.hasError('required')).toBeTrue();
      expect(lastName.hasError('required')).toBeTrue();
      expect(email.hasError('required')).toBeTrue();
      expect(password.hasError('required')).toBeTrue();
      expect(confirmPassword.hasError('required')).toBeTrue();
    });

    it('should validate name character limits (max 50 chars)', () => {
      const longName = 'A'.repeat(51);
      component.form.controls.firstName.setValue(longName);
      component.form.controls.middleName.setValue(longName);
      component.form.controls.lastName.setValue(longName);

      expect(component.form.controls.firstName.hasError('maxlength')).toBeTrue();
      expect(component.form.controls.middleName.hasError('maxlength')).toBeTrue();
      expect(component.form.controls.lastName.hasError('maxlength')).toBeTrue();

      const valid50 = 'A'.repeat(50);
      component.form.controls.firstName.setValue(valid50);
      component.form.controls.middleName.setValue(valid50);
      component.form.controls.lastName.setValue(valid50);

      expect(component.form.controls.firstName.hasError('maxlength')).toBeFalse();
      expect(component.form.controls.middleName.hasError('maxlength')).toBeFalse();
      expect(component.form.controls.lastName.hasError('maxlength')).toBeFalse();
    });

    it('should enforce name patterns (letters, spaces, hyphens, apostrophes)', () => {
      component.form.controls.firstName.setValue('Juan123');
      expect(component.form.controls.firstName.hasError('pattern')).toBeTrue();

      component.form.controls.firstName.setValue('Mary-Jane');
      expect(component.form.controls.firstName.hasError('pattern')).toBeFalse();

      component.form.controls.lastName.setValue("O'Connor");
      expect(component.form.controls.lastName.hasError('pattern')).toBeFalse();

      // Middle name is optional, empty string is valid
      component.form.controls.middleName.setValue('');
      expect(component.form.controls.middleName.valid).toBeTrue();
    });

    it('should enforce minimum password length of 6 characters', () => {
      component.form.controls.password.setValue('12345');
      expect(component.form.controls.password.hasError('minlength')).toBeTrue();

      component.form.controls.password.setValue('123456');
      expect(component.form.controls.password.hasError('minlength')).toBeFalse();
    });

    it('should detect password confirmation mismatch', () => {
      component.form.controls.password.setValue('password123');
      component.form.controls.confirmPassword.setValue('different123');

      expect(component.form.hasError('passwordMismatch')).toBeTrue();

      component.form.controls.confirmPassword.setValue('password123');
      expect(component.form.hasError('passwordMismatch')).toBeFalse();
    });

    it('should validate email format and require @dlsud.edu.ph domain', () => {
      component.form.controls.email.setValue('not-an-email');
      expect(component.form.controls.email.hasError('pattern')).toBeTrue();

      component.form.controls.email.setValue('user@gmail.com');
      expect(component.form.controls.email.hasError('pattern')).toBeTrue();

      component.form.controls.email.setValue('user@dlsu.edu.ph');
      expect(component.form.controls.email.hasError('pattern')).toBeTrue();

      component.form.controls.email.setValue('student@dlsud.edu.ph');
      expect(component.form.controls.email.hasError('pattern')).toBeFalse();
    });
  });

  describe('submission', () => {
    it('should not call authService.register when form is invalid', () => {
      const registerSpy = spyOn(authService, 'register');
      component.onSubmit();

      expect(registerSpy).not.toHaveBeenCalled();
      expect(component.form.touched).toBeTrue();
    });

    it('should call authService.register with combined fullName on valid submission', () => {
      const registerResponse: RegisterResponse = {
        message: 'User registered successfully',
        userId: 10,
      };
      const registerSpy = spyOn(authService, 'register').and.returnValue(
        of(registerResponse),
      );
      const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

      component.form.setValue(validFormValues);
      component.onSubmit();

      expect(registerSpy).toHaveBeenCalledWith({
        fullName: 'Juan Protacio Dela Cruz',
        email: 'juan@dlsud.edu.ph',
        password: 'Password123!',
        affiliation: ClinicAffiliation.STUDENT,
      });
      expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
        queryParams: { registered: '1' },
      });
    });

    it('should display error message on registration failure', () => {
      const errorResponse = new HttpErrorResponse({
        status: 409,
        error: { message: 'Email is already registered' },
      });
      spyOn(authService, 'register').and.returnValue(
        throwError(() => errorResponse),
      );

      component.form.setValue(validFormValues);
      component.onSubmit();

      expect(component.errorMessage()).toBe('Email is already registered');
      expect(component.loading()).toBeFalse();
    });
  });
});

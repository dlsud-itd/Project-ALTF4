import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl, FormBuilder, ReactiveFormsModule,
  ValidationErrors, ValidatorFn, Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { ClinicAffiliation, RegisterResponse } from '@core/models';
import { AuthService } from '@core/services';
import { getErrorMessage } from '@core/utils';
import {
  AffiliationSelectorComponent,
  AuthBrandComponent,
  AuthCardComponent,
} from '@shared/ui';

// Password and name validation constraints
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 100;
const MAX_NAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 100;
const NAME_PATTERN = /^[a-zA-ZÀ-ÿ\s'-]+$/;
const OPTIONAL_NAME_PATTERN = /^[a-zA-ZÀ-ÿ\s'-]*$/;
const DLSUD_EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@dlsud\.edu\.ph$/i;

const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password: unknown = group.get('password')?.value;
  const confirm: unknown = group.get('confirmPassword')?.value;
  return password === confirm ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, Button, InputText, Message, Password,
    AuthBrandComponent, AuthCardComponent, AffiliationSelectorComponent,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['../auth-form.scss', './register.component.scss'],
})
export class RegisterComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);

  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      firstName: [
        '',
        {
          validators: [
            Validators.required,
            Validators.maxLength(MAX_NAME_LENGTH),
            Validators.pattern(NAME_PATTERN),
          ],
        },
      ],
      middleName: [
        '',
        {
          validators: [
            Validators.maxLength(MAX_NAME_LENGTH),
            Validators.pattern(OPTIONAL_NAME_PATTERN),
          ],
        },
      ],
      lastName: [
        '',
        {
          validators: [
            Validators.required,
            Validators.maxLength(MAX_NAME_LENGTH),
            Validators.pattern(NAME_PATTERN),
          ],
        },
      ],
      email: [
        '',
        {
          validators: [
            Validators.required,
            Validators.pattern(DLSUD_EMAIL_PATTERN),
            Validators.maxLength(MAX_EMAIL_LENGTH),
          ],
        },
      ],
      password: [
        '',
        {
          validators: [
            Validators.required,
            Validators.minLength(MIN_PASSWORD_LENGTH),
            Validators.maxLength(MAX_PASSWORD_LENGTH),
          ],
        },
      ],
      confirmPassword: [
        '',
        {
          validators: [
            Validators.required,
            Validators.maxLength(MAX_PASSWORD_LENGTH),
          ],
        },
      ],
      affiliation: this.fb.nonNullable.control<ClinicAffiliation>(ClinicAffiliation.STUDENT),
    },
    { validators: [passwordsMatch] },
  );

  showError(
    controlName:
      | 'firstName'
      | 'middleName'
      | 'lastName'
      | 'email'
      | 'password'
      | 'confirmPassword',
  ): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  showMismatch(): boolean {
    const confirm = this.form.controls.confirmPassword;
    return this.form.hasError('passwordMismatch') && (confirm.touched || confirm.dirty);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { firstName, middleName, lastName, email, password, affiliation } = this.form.getRawValue();
    const fullName = [firstName.trim(), middleName.trim(), lastName.trim()]
      .filter(Boolean)
      .join(' ');

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.register({ fullName, email, password, affiliation }).subscribe({
      next: (_response: RegisterResponse): void => {
        this.loading.set(false);
        void this.router.navigate(['/login'], { queryParams: { registered: '1' } });
      },
      error: (error: HttpErrorResponse): void => {
        this.loading.set(false);
        this.errorMessage.set(getErrorMessage(error, 'Registration failed. Please try again.'));
      },
    });
  }
}

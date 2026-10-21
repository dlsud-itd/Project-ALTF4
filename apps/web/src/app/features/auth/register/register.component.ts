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
import { ClinicAffiliation, RegisterResponse } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';
import { getErrorMessage } from '../../../core/utils/http-error.util';
import { AffiliationSelectorComponent } from '../../../shared/ui/affiliation-selector/affiliation-selector.component';
import { AuthBrandComponent } from '../../../shared/ui/auth-brand/auth-brand.component';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';

// TODO(Lim, Jereign): confirm the final password rules with the team (API only requires 6+)
const MIN_PASSWORD_LENGTH = 6;

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
      fullName: ['', { validators: [Validators.required, Validators.maxLength(100)] }],
      email: ['', { validators: [Validators.required, Validators.email] }],
      password: ['', { validators: [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)] }],
      confirmPassword: ['', { validators: [Validators.required] }],
      affiliation: this.fb.nonNullable.control<ClinicAffiliation>(ClinicAffiliation.STUDENT),
    },
    { validators: [passwordsMatch] },
  );

  showError(controlName: 'fullName' | 'email' | 'password' | 'confirmPassword'): boolean {
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
    const { fullName, email, password, affiliation } = this.form.getRawValue();
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
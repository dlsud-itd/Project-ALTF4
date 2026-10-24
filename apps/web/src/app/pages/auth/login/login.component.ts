import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { ClinicAffiliation, LoginResponse } from '@core/models';
import { AuthService } from '@core/services';
import {
  getErrorMessage,
  getHomeRoute,
  getSafeReturnUrl,
} from '@core/utils';
import {
  AuthBrandComponent,
  AuthCardComponent,
} from '@shared/ui';

// Component handling user credentials input, sign-in authentication, and role-based redirection.
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    InputText,
    Message,
    Password,
    AuthBrandComponent,
    AuthCardComponent,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['../auth-form.scss'],
})
export class LoginComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly justRegistered = this.route.snapshot.queryParamMap.has('registered');
  readonly accountInactive = this.route.snapshot.queryParamMap.get('error') === 'inactive';

  readonly form = this.fb.nonNullable.group({
    email: ['', { validators: [Validators.required, Validators.email] }],
    password: ['', { validators: [Validators.required] }],
    affiliation: this.fb.nonNullable.control<ClinicAffiliation>(ClinicAffiliation.STUDENT),
  });

  // Checks whether a specific form control is invalid and has been touched or modified by the user.
  showError(controlName: 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  // Validates form inputs, dispatches sign-in request to AuthService, and navigates to the destination route.
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login({ email, password }).subscribe({
      next: (response: LoginResponse): void => {
        this.loading.set(false);
                const returnUrl: string | null = getSafeReturnUrl(
          this.route.snapshot.queryParamMap.get('returnUrl'),
        );
        void this.router.navigateByUrl(
          returnUrl ?? getHomeRoute(response.role),
        );
      },
      error: (error: HttpErrorResponse): void => {
        this.loading.set(false);
        this.errorMessage.set(getErrorMessage(error, 'Sign in failed. Please try again.'));
      },
    });
  }
}

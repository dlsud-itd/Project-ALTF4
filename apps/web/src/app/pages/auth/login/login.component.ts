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
import { getErrorMessage, getHomeRoute } from '@core/utils';
import {
  AffiliationSelectorComponent,
  AuthBrandComponent,
  AuthCardComponent,
} from '@shared/ui';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, Button, InputText, Message, Password,
    AuthBrandComponent, AuthCardComponent,
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
  readonly justRegistered: boolean = this.route.snapshot.queryParamMap.has('registered');

  readonly form = this.fb.nonNullable.group({
    email: ['', { validators: [Validators.required, Validators.email] }],
    password: ['', { validators: [Validators.required] }],
    // TODO(Lim, Jereign): affiliation is in the mockup but the login API ignores it, confirm with the team
    affiliation: this.fb.nonNullable.control<ClinicAffiliation>(ClinicAffiliation.STUDENT),
  });

  showError(controlName: 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

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
        void this.router.navigateByUrl(getHomeRoute(response.role));
      },
      error: (error: HttpErrorResponse): void => {
        this.loading.set(false);
        this.errorMessage.set(getErrorMessage(error, 'Sign in failed. Please try again.'));
      },
    });
  }
}

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, interval, takeWhile } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_OTP_LENGTH,
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
} from '@core/config/clinic.constants';
import {
  RequestPasswordResetResponse,
  VerifyPasswordResetOtpResponse,
} from '@core/models';
import { AuthService } from '@core/services';
import { getErrorMessage } from '@core/utils';
import { AuthBrandComponent, AuthCardComponent } from '@shared/ui';

export enum ForgotPasswordStep {
  REQUEST = 'REQUEST',
  VERIFY = 'VERIFY',
  RESET = 'RESET',
}

const OTP_PATTERN = /^\d{6}$/;
const NON_WHITESPACE_PATTERN = /\S/;

const resetPasswordsMatch: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const newPassword: unknown = group.get('newPassword')?.value;
  const confirmPassword: unknown = group.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../auth-form.scss', './forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private countdownSub: Subscription | null = null;
  private normalizedEmail = '';
  private resetToken = '';

  readonly Step = ForgotPasswordStep;
  readonly otpLength = PASSWORD_RESET_OTP_LENGTH;
  readonly minPasswordLength = PASSWORD_MIN_LENGTH;
  readonly maxPasswordLength = PASSWORD_MAX_LENGTH;

  readonly step = signal<ForgotPasswordStep>(ForgotPasswordStep.REQUEST);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);
  readonly resendCooldown = signal<number>(0);

  readonly requestForm = this.fb.nonNullable.group({
    email: [
      '',
      {
        validators: [
          Validators.required,
          Validators.email,
          Validators.maxLength(254),
        ],
      },
    ],
  });

  readonly verifyForm = this.fb.nonNullable.group({
    otp: [
      '',
      {
        validators: [Validators.required, Validators.pattern(OTP_PATTERN)],
      },
    ],
  });

  readonly resetForm = this.fb.nonNullable.group(
    {
      newPassword: [
        '',
        {
          validators: [
            Validators.required,
            Validators.minLength(PASSWORD_MIN_LENGTH),
            Validators.maxLength(PASSWORD_MAX_LENGTH),
            Validators.pattern(NON_WHITESPACE_PATTERN),
          ],
        },
      ],
      confirmPassword: [
        '',
        {
          validators: [
            Validators.required,
            Validators.maxLength(PASSWORD_MAX_LENGTH),
          ],
        },
      ],
    },
    { validators: [resetPasswordsMatch] },
  );

  showRequestError(): boolean {
    const control = this.requestForm.controls.email;
    return control.invalid && (control.touched || control.dirty);
  }

  showVerifyError(): boolean {
    const control = this.verifyForm.controls.otp;
    return control.invalid && (control.touched || control.dirty);
  }

  showResetError(controlName: 'newPassword' | 'confirmPassword'): boolean {
    const control = this.resetForm.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  showPasswordMismatch(): boolean {
    const confirm = this.resetForm.controls.confirmPassword;
    return (
      this.resetForm.hasError('passwordMismatch') &&
      (confirm.touched || confirm.dirty)
    );
  }

  onOtpInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitsOnly = input.value
      .replace(/\D/g, '')
      .slice(0, PASSWORD_RESET_OTP_LENGTH);
    if (input.value !== digitsOnly) {
      input.value = digitsOnly;
    }
    this.verifyForm.controls.otp.setValue(digitsOnly);
  }

  onRequestSubmit(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    const email = this.requestForm.getRawValue().email.trim().toLowerCase();
    this.normalizedEmail = email;
    this.sendOtpRequest(email, true);
  }

  onResendOtp(): void {
    if (this.resendCooldown() > 0 || this.loading() || !this.normalizedEmail) {
      return;
    }
    this.sendOtpRequest(this.normalizedEmail, false);
  }

  onChangeEmail(): void {
    this.stopCountdown();
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.verifyForm.reset();
    this.step.set(ForgotPasswordStep.REQUEST);
  }

  onVerifySubmit(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    const { otp } = this.verifyForm.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .verifyPasswordResetOtp({
        email: this.normalizedEmail,
        otp,
      })
      .subscribe({
        next: (res: VerifyPasswordResetOtpResponse): void => {
          this.loading.set(false);
          this.stopCountdown();
          this.resetToken = res.resetToken;
          this.infoMessage.set(null);
          this.step.set(ForgotPasswordStep.RESET);
        },
        error: (error: HttpErrorResponse): void => {
          this.loading.set(false);
          this.errorMessage.set(
            getErrorMessage(error, 'Invalid or expired verification code.'),
          );
        },
      });
  }

  onResetSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const { newPassword, confirmPassword } = this.resetForm.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .resetPassword({
        resetToken: this.resetToken,
        newPassword,
        confirmPassword,
      })
      .subscribe({
        next: (): void => {
          this.loading.set(false);
          void this.router.navigate(['/login'], {
            queryParams: { reset: 'success' },
          });
        },
        error: (error: HttpErrorResponse): void => {
          this.loading.set(false);
          this.errorMessage.set(
            getErrorMessage(
              error,
              'Could not reset password. Please try again.',
            ),
          );
        },
      });
  }

  private sendOtpRequest(email: string, advanceStep: boolean): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.authService.requestPasswordReset({ email }).subscribe({
      next: (res: RequestPasswordResetResponse): void => {
        this.loading.set(false);
        this.infoMessage.set(res.message);
        this.startCountdown(
          res.cooldownSeconds || PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
        );
        if (advanceStep) {
          this.verifyForm.reset();
          this.step.set(ForgotPasswordStep.VERIFY);
        }
      },
      error: (error: HttpErrorResponse): void => {
        this.loading.set(false);
        this.errorMessage.set(
          getErrorMessage(
            error,
            'Unable to send verification code right now. Please try again.',
          ),
        );
      },
    });
  }

  private startCountdown(seconds: number): void {
    this.stopCountdown();
    this.resendCooldown.set(seconds);
    this.countdownSub = interval(1000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        takeWhile((): boolean => this.resendCooldown() > 0),
      )
      .subscribe((): void => {
        const nextValue = this.resendCooldown() - 1;
        this.resendCooldown.set(nextValue > 0 ? nextValue : 0);
      });
  }

  private stopCountdown(): void {
    if (this.countdownSub) {
      this.countdownSub.unsubscribe();
      this.countdownSub = null;
    }
    this.resendCooldown.set(0);
  }
}

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const PH_MOBILE_E164_REGEX = /^\+639\d{9}$/;

export function normalizePhMobile(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const digitsOnly = trimmed.replace(/[\s\-()]/g, '');

  if (/^09\d{9}$/.test(digitsOnly)) {
    return `+63${digitsOnly.slice(1)}`;
  }

  if (/^639\d{9}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  if (/^\+639\d{9}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  return trimmed;
}

export const phMobileValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const raw = typeof control.value === 'string' ? control.value.trim() : '';
  if (!raw) {
    return null;
  }

  return PH_MOBILE_E164_REGEX.test(normalizePhMobile(raw))
    ? null
    : { phMobile: true };
};

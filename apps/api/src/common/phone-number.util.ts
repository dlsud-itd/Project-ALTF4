export const PH_MOBILE_E164_REGEX = /^\+639\d{9}$/;

/**
 * Strips whitespace, hyphens, and parentheses and converts common Philippine
 * mobile formats (09XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX) into E.164 (+639XXXXXXXXX).
 * Returns the original trimmed value if it cannot be normalized so DTO validation fails cleanly.
 */
export function normalizePhMobile(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

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

export function isValidPhMobile(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = normalizePhMobile(value);
  return (
    typeof normalized === 'string' &&
    PH_MOBILE_E164_REGEX.test(normalized) &&
    normalized !== '+639000000000'
  );
}

/**
 * Masks a phone number for safe logging (e.g., +639171234567 -> +63917***4567).
 */
export function maskPhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 7) {
    return '***';
  }
  return `${trimmed.slice(0, 6)}***${trimmed.slice(-4)}`;
}

import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { PASSWORD_RESET_OTP_LENGTH } from '../common/clinic.constants';

/**
 * Generates a cryptographically random numeric OTP of the configured length.
 */
export function generateNumericOtp(
  length: number = PASSWORD_RESET_OTP_LENGTH,
): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
}

/**
 * Generates a high-entropy single-use reset proof token.
 */
export function generateResetProofToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Computes an HMAC-SHA256 hex digest for an OTP or reset token.
 */
export function hashOtpOrToken(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Performs a constant-time comparison between a plain value and a stored HMAC-SHA256 hash.
 */
export function verifyOtpOrTokenHash(
  plainValue: string,
  storedHash: string,
  secret: string,
): boolean {
  const candidateHash = hashOtpOrToken(plainValue, secret);
  const candidateBuf = Buffer.from(candidateHash, 'utf8');
  const storedBuf = Buffer.from(storedHash, 'utf8');
  if (candidateBuf.length !== storedBuf.length) {
    return false;
  }
  return timingSafeEqual(candidateBuf, storedBuf);
}

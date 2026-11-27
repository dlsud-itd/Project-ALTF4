import {
  generateNumericOtp,
  generateResetProofToken,
  hashOtpOrToken,
  verifyOtpOrTokenHash,
} from './otp.util';

describe('otp.util', () => {
  const secret = 'test-otp-secret';

  it('generates a 6-digit zero-padded numeric OTP', () => {
    for (let i = 0; i < 20; i += 1) {
      const otp = generateNumericOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it('generates a 64-char hex reset proof token', () => {
    const token = generateResetProofToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashes and verifies OTPs in constant time', () => {
    const otp = '042819';
    const hash = hashOtpOrToken(otp, secret);

    expect(hash).not.toBe(otp);
    expect(verifyOtpOrTokenHash(otp, hash, secret)).toBe(true);
    expect(verifyOtpOrTokenHash('042818', hash, secret)).toBe(false);
    expect(verifyOtpOrTokenHash(otp, hash, 'wrong-secret')).toBe(false);
  });
});

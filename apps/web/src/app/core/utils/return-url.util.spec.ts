import { getSafeReturnUrl } from './return-url.util';

describe('getSafeReturnUrl', () => {
  it('should return null when there is no return url', () => {
    expect(getSafeReturnUrl(null)).toBeNull();
    expect(getSafeReturnUrl('')).toBeNull();
  });

  it('should accept an in-app path with query and hash', () => {
    expect(getSafeReturnUrl('/patient')).toBe('/patient');
    expect(getSafeReturnUrl('/staff?tab=queue#top')).toBe(
      '/staff?tab=queue#top',
    );
  });

  it('should reject an absolute url', () => {
    expect(getSafeReturnUrl('https://evil.example')).toBeNull();
    expect(getSafeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('should reject a protocol-relative url', () => {
    expect(getSafeReturnUrl('//evil.example')).toBeNull();
  });

  it('should reject backslash tricks', () => {
    expect(getSafeReturnUrl('/\\evil.example')).toBeNull();
    expect(getSafeReturnUrl('/patient\\..\\evil')).toBeNull();
  });

  it('should reject a path without a leading slash', () => {
    expect(getSafeReturnUrl('patient')).toBeNull();
  });

  it('should reject a path with whitespace', () => {
    expect(getSafeReturnUrl('/patient dashboard')).toBeNull();
  });

  it('should not send users back to a guest page', () => {
    expect(getSafeReturnUrl('/login')).toBeNull();
    expect(getSafeReturnUrl('/register?x=1')).toBeNull();
  });
});
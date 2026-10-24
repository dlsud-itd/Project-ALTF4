const SAFE_IN_APP_PATH = /^\/(?![/\\])[^\\\s]*$/;
const GUEST_PATHS: string[] = ['/login', '/register'];

export const getSafeReturnUrl = (returnUrl: string | null): string | null => {
  if (!returnUrl || !SAFE_IN_APP_PATH.test(returnUrl)) {
    return null;
  }
  const path: string = returnUrl.split(/[?#]/)[0];
  return GUEST_PATHS.includes(path) ? null : returnUrl;
};
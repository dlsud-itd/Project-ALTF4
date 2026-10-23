import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { getHomeRoute } from '../utils/role-route.util';

// Redirects already authenticated users away from guest pages (login/register) to their dashboard.
export const guestGuard: CanActivateFn = (): boolean => {
  const authService: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  if (authService.isAuthenticated()) {
    const role: string = authService.currentUser()?.role ?? 'PATIENT';
    void router.navigateByUrl(getHomeRoute(role));
    return false;
  }

  return true;
};

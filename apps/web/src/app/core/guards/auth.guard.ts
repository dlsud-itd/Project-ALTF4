import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

// Prevents unauthenticated or deactivated users from accessing protected routes, redirecting them to login.
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): boolean => {
  const authService: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  if (!authService.isAuthenticated()) {
    void router.navigate(['/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  const user = authService.currentUser();
  if (user && !user.isActive) {
    authService.clearSession();
    void router.navigate(['/login'], {
      queryParams: { error: 'inactive' },
    });
    return false;
  }

  return true;
};

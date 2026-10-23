import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { getHomeRoute } from '../utils/role-route.util';

// Verifies that the authenticated user possesses one of the roles declared on the target route.
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
): boolean => {
  const authService: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  const allowedRoles = route.data['roles'] as string[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  const user = authService.currentUser();
  if (!user) {
    void router.navigate(['/login']);
    return false;
  }

  const userRole = user.role.toUpperCase();
  const hasAccess = allowedRoles.some(
    (role: string) => role.toUpperCase() === userRole,
  );

  if (!hasAccess) {
    void router.navigateByUrl(getHomeRoute(userRole));
    return false;
  }

  return true;
};

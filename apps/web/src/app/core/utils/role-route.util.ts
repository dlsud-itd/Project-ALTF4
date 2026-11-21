// Mapping of user access roles to their default authenticated dashboard destination.
const HOME_ROUTES: Record<string, string> = {
  PATIENT: '/patient',
  STAFF: '/staff',
  ADMIN: '/admin/dashboard',
};

// Resolves the destination URL for a given role, falling back to login if unrecognized.
export const getHomeRoute = (role: string): string =>
  HOME_ROUTES[role.toUpperCase()] ?? '/login';

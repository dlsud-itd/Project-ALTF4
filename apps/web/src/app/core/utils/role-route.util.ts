const HOME_ROUTES: Record<string, string> = {
  PATIENT: '/patient',
  STAFF: '/staff',
  // TODO(Lim, Jereign): point ADMIN to the admin screens once /admin exists
  ADMIN: '/staff',
};

export const getHomeRoute = (role: string): string =>
  HOME_ROUTES[role.toUpperCase()] ?? '/login';
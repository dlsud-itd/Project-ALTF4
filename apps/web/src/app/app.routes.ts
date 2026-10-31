import { Routes } from '@angular/router';
import {
  AuthLayoutComponent,
  PatientLayoutComponent,
  StaffLayoutComponent,
} from '@layouts';
import {
  LoginComponent,
  RegisterComponent,
  PatientDashboardComponent,
  BookingsComponent,
  PatientProfileComponent,
  StaffDashboardComponent,
  StaffScheduleComponent,
  StaffProfileComponent,
} from '@pages';
import { authGuard, guestGuard, roleGuard } from '@core/guards';

export const routes: Routes = [
  // Default landing page
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Sign In & Register pages (only accessible for unauthenticated guests)
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        component: LoginComponent,
        canActivate: [guestGuard],
      },
      {
        path: 'register',
        component: RegisterComponent,
        canActivate: [guestGuard],
      },
    ],
  },

  // Protected Patient Portal (requires authentication & PATIENT role)
  {
    path: 'patient',
    component: PatientLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['PATIENT'] },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: PatientDashboardComponent },
      { path: 'bookings', component: BookingsComponent },
      { path: 'profile', component: PatientProfileComponent },
    ],
  },

  // Protected Staff Operations Console (requires authentication & STAFF or ADMIN role)
  {
    path: 'staff',
    component: StaffLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['STAFF', 'ADMIN'] },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: StaffDashboardComponent },
      { path: 'schedule', component: StaffScheduleComponent },
      { path: 'profile', component: StaffProfileComponent },
    ],
  },

  // Fallback for unknown URLs
  { path: '**', redirectTo: 'login' },
];

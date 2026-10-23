import { Routes } from '@angular/router';
import { AuthLayoutComponent } from '@layouts/auth-layout/auth-layout.component';
import {
  LoginComponent,
  RegisterComponent,
  PatientDashboardComponent,
  StaffDashboardComponent,
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

  // Protected Patient Dashboard (requires authentication & PATIENT role)
  {
    path: 'patient',
    component: PatientDashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['PATIENT'] },
  },

  // Protected Staff Dashboard (requires authentication & STAFF or ADMIN role)
  {
    path: 'staff',
    component: StaffDashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['STAFF', 'ADMIN'] },
  },

  // Fallback for unknown URLs
  { path: '**', redirectTo: 'login' },
];
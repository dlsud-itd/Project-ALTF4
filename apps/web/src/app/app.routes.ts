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
  PatientBookingsHistoryComponent,
  PatientProfileComponent,
  PatientQueueComponent,
  PatientNotificationsComponent,
  StaffDashboardComponent,
  StaffWalkInComponent,
  StaffScheduleComponent,
  StaffPastAppointmentsComponent,
  StaffProfileComponent,
  AdminDashboardComponent,
  AdminUsersComponent,
  AdminAppointmentsComponent,
  AdminAuditLogsComponent,
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
      { path: 'schedule', component: BookingsComponent },
      { path: 'bookings', component: PatientBookingsHistoryComponent },
      { path: 'history', redirectTo: 'bookings', pathMatch: 'full' },
      { path: 'queue', component: PatientQueueComponent },
      { path: 'notifications', component: PatientNotificationsComponent },
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
      { path: 'walk-in', component: StaffWalkInComponent },
      { path: 'schedule', component: StaffScheduleComponent },
      { path: 'past-appointments', component: StaffPastAppointmentsComponent },
      { path: 'profile', component: StaffProfileComponent },
    ],
  },

  // Protected Admin Portal (requires authentication & ADMIN role)
  {
    path: 'admin',
    component: StaffLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'appointments', component: AdminAppointmentsComponent },
      { path: 'audit-logs', component: AdminAuditLogsComponent },
    ],
  },

  // Fallback for unknown URLs
  { path: '**', redirectTo: 'login' },
];

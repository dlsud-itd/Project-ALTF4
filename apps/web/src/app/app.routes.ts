import { Routes } from '@angular/router';
import { AuthLayoutComponent } from '@layouts/auth-layout/auth-layout.component';
import {
  LoginComponent,
  RegisterComponent,
  PatientDashboardComponent,
  StaffDashboardComponent,
} from '@pages';

export const routes: Routes = [
  // Default landing page
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Sign In & Register pages
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ],
  },

  //Direct access to dashboards (no login required)
  { path: 'patient', component: PatientDashboardComponent },
  { path: 'staff', component: StaffDashboardComponent },

  //Fallback for unknown URLs
  { path: '**', redirectTo: 'login' },
];
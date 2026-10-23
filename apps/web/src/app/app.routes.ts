import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './features/auth/auth-layout/auth-layout.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { QueueDisplayComponent } from './features/queue-display/queue-display.component';
import { PatientPortalComponent } from './features/patient-portal/patient-portal.component';
import { StaffDashboardComponent } from './features/staff-dashboard/staff-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'display', pathMatch: 'full' },
  { path: 'display', component: QueueDisplayComponent },
  { path: 'patient', component: PatientPortalComponent },
  { path: 'staff', component: StaffDashboardComponent },
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ],
  },
  { path: '**', redirectTo: 'display' },
];
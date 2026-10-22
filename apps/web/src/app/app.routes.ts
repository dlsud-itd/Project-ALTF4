import { Routes } from '@angular/router';
import { AuthLayoutComponent } from '@layouts/auth-layout/auth-layout.component';
import { LoginComponent } from '@pages/auth/login/login.component';
import { RegisterComponent } from '@pages/auth/register/register.component';
import { PatientDashboardComponent } from '@pages/patient-dashboard/patient-dashboard.component';
import { StaffDashboardComponent } from '@pages/staff-dashboard/staff-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ],
  },
  { path: 'patient', component: PatientDashboardComponent },
  { path: 'staff', component: StaffDashboardComponent },
  { path: '**', redirectTo: 'login' },
];

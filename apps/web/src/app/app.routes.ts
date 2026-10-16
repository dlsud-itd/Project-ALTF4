import { Routes } from '@angular/router';
import { QueueDisplayComponent } from './features/queue-display/queue-display.component';
import { PatientPortalComponent } from './features/patient-portal/patient-portal.component';
import { StaffDashboardComponent } from './features/staff-dashboard/staff-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'display', pathMatch: 'full' },
  { path: 'display', component: QueueDisplayComponent },
  { path: 'patient', component: PatientPortalComponent },
  { path: 'staff', component: StaffDashboardComponent },
  { path: '**', redirectTo: 'display' },
];

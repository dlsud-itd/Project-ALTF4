import { Component, OnInit, inject } from '@angular/core';
import { Button } from 'primeng/button';
import {
  EmptyStateComponent,
  LoadingSkeletonComponent,
  NoticeComponent,
} from '@shared/ui';
import { StaffAppointmentsPanelComponent } from './components/staff-appointments-panel.component';
import { StaffDashboardDialogsComponent } from './components/staff-dashboard-dialogs.component';
import { StaffQueuePanelComponent } from './components/staff-queue-panel.component';
import { StaffDashboardFacade } from './services/staff-dashboard.facade';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [
    Button,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    NoticeComponent,
    StaffAppointmentsPanelComponent,
    StaffDashboardDialogsComponent,
    StaffQueuePanelComponent,
  ],
  providers: [StaffDashboardFacade],
  templateUrl: './staff-dashboard.component.html',
  styleUrl: './staff-dashboard.component.scss',
})
export class StaffDashboardComponent implements OnInit {
  readonly dashboard = inject(StaffDashboardFacade);

  ngOnInit(): void {
    this.dashboard.initialize();
  }
}

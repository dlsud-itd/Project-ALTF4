import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { AdminService } from '@core/services';
import { AdminStats } from '@core/models';
import {
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';
import { getErrorMessage } from '@core/utils';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Button,
    ErrorStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly stats = signal<AdminStats | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.adminService.getStats().subscribe({
      next: (res) => {
        this.stats.set(res.stats);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(
          getErrorMessage(err, 'Failed to retrieve administrative statistics'),
        );
        this.isLoading.set(false);
      },
    });
  }
}

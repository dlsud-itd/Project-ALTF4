import { Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/services';

// Staff profile view placeholder template.
@Component({
  selector: 'app-staff-profile',
  standalone: true,
  imports: [],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class StaffProfileComponent {
  private readonly authService = inject(AuthService);

  readonly user = computed(() => this.authService.currentUser());
  readonly fullName = computed(
    (): string => this.user()?.fullName ?? 'Staff Nurse',
  );
  readonly email = computed(
    (): string => this.user()?.email ?? 'staff@dlsud.edu.ph',
  );
  readonly role = computed(
    (): string => this.user()?.role ?? 'STAFF',
  );
}


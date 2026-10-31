import { Component, computed, inject } from '@angular/core';
import { AuthService } from '@core/services';

// Patient profile view placeholder template.
@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class PatientProfileComponent {
  private readonly authService = inject(AuthService);

  readonly user = computed(() => this.authService.currentUser());
  readonly fullName = computed(
    (): string => this.user()?.fullName ?? 'Patient User',
  );
  readonly email = computed(
    (): string => this.user()?.email ?? 'patient@dlsud.edu.ph',
  );
  readonly affiliation = computed(
    (): string => this.user()?.affiliation ?? 'COLLEGE',
  );
}


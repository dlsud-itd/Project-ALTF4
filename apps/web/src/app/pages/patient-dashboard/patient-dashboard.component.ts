import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { AuthService } from '@core/services';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '@shared/ui';

// Patient portal component presenting ticket status, clinic schedules, and navigation.
@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [ 
    Button, 
    EmptyStateComponent, 
    ErrorStateComponent, 
    LoadingSkeletonComponent,
  ],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
})
export class PatientDashboardComponent {
  private static readonly SECTION_IDS = ['queue-operations', 'schedules', 'appointments'];

  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);

  readonly patientName = computed((): string => this.authService.currentUser()?.fullName ?? 'Patient');
  readonly currentTicket = signal<string | null>(null);
  readonly nowServingTicket = signal<string>('A-104');
  readonly activeSection = signal<string>('queue-operations');

  // TODO(Lim, Jereign): drive these from the queue API once it is connected
  readonly isQueueLoading = signal<boolean>(false);
  readonly hasQueueError = signal<boolean>(false);

  // Triggers safe user session invalidation and redirects to the sign-in page.
  onLogout(): void {
    this.authService.performLogout();
  }

  constructor() {
    afterNextRender(() => this.observeSections());
  }

  // Enqueues the patient into the active daily queue and assigns an estimated wait ticket.
  onJoinQueue(): void {
    this.currentTicket.set('A-108');
  }

  // Cancels the current queue ticket and resets active patient queue state.
  onLeaveQueue(): void {
    this.currentTicket.set(null);
  }

  // Clears the queue error so the status card can load again.
  onRetryQueue(): void {
    this.hasQueueError.set(false);
  }

  // Smoothly navigates the viewport to the target portal section and updates window URL hash.
  scrollToSection(sectionId: string): void {
    this.activeSection.set(sectionId);

    const target = document.getElementById(sectionId);
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 8;
      window.scrollTo({ top, behavior: 'auto' });
    }

    history.replaceState(null, '', `${location.pathname}${location.search}#${sectionId}`);
  }

  // Attaches an IntersectionObserver to update active navigation tabs dynamically on page scroll.
  private observeSections(): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          this.activeSection.set(visible.target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );

    for (const id of PatientDashboardComponent.SECTION_IDS) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}

import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [Button, RouterLink],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
})
export class PatientDashboardComponent {
  private static readonly SECTION_IDS = ['queue-operations', 'schedules', 'appointments'];

  private readonly destroyRef = inject(DestroyRef);

  readonly patientName = signal<string>('Juan Dela Cruz');
  readonly currentTicket = signal<string | null>(null);
  readonly nowServingTicket = signal<string>('A-104');
  readonly activeSection = signal<string>('queue-operations');

  constructor() {
    afterNextRender(() => this.observeSections());
  }

  onJoinQueue(): void {
    this.currentTicket.set('A-108');
  }

  onLeaveQueue(): void {
    this.currentTicket.set(null);
  }

  scrollToSection(sectionId: string): void {
    this.activeSection.set(sectionId);

    const target = document.getElementById(sectionId);
    if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 8;
      window.scrollTo({ top, behavior: 'auto' });
    }

    history.replaceState(null, '', `${location.pathname}${location.search}#${sectionId}`);
  }

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

import { Component, computed, signal } from '@angular/core';
import { Tag } from 'primeng/tag';
import { QueueStatus } from '@core/models';

type TagSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

type TrackerStepState = 'done' | 'current' | 'upcoming';

type SampleQueueEntry = {
  ticketNumber: string;
  status: QueueStatus;
  positionInQueue: number;
  estimatedWaitMinutes: number;
};

type SampleQueueSummary = {
  nowServing: string;
  patientsWaiting: number;
  lastUpdated: string;
};

// TODO(Lim, Jereign): replace with real data in CQ-S4-4.4.02
const SAMPLE_QUEUE_ENTRY: SampleQueueEntry = {
  ticketNumber: 'A-014',
  status: QueueStatus.WAITING,
  positionInQueue: 3,
  estimatedWaitMinutes: 15,
};

// TODO(Lim, Jereign): replace with real data in CQ-S4-4.4.02
const SAMPLE_QUEUE_SUMMARY: SampleQueueSummary = {
  nowServing: 'A-011',
  patientsWaiting: 5,
  lastUpdated: '10:42 AM',
};

const FIRST_POSITION = 1;

const STATUS_LABELS: Record<QueueStatus, string> = {
  [QueueStatus.WAITING]: 'Waiting',
  [QueueStatus.CALLED]: 'Called',
  [QueueStatus.IN_SERVICE]: 'In Service',
  [QueueStatus.SERVED]: 'Served',
  [QueueStatus.CANCELLED]: 'Cancelled',
  [QueueStatus.NO_SHOW]: 'No Show',
};

const STATUS_SEVERITIES: Record<QueueStatus, TagSeverity> = {
  [QueueStatus.WAITING]: 'warn',
  [QueueStatus.CALLED]: 'info',
  [QueueStatus.IN_SERVICE]: 'info',
  [QueueStatus.SERVED]: 'success',
  [QueueStatus.CANCELLED]: 'danger',
  [QueueStatus.NO_SHOW]: 'secondary',
};

// Ordered steps of a normal visit, shown in the progress tracker.
const TRACKER_STEPS: readonly QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_SERVICE,
  QueueStatus.SERVED,
];

const TERMINAL_STATUSES: readonly QueueStatus[] = [
  QueueStatus.CANCELLED,
  QueueStatus.NO_SHOW,
];

// Patient virtual queue screen: ticket, position, wait and entry status.
@Component({
  selector: 'app-patient-queue',
  standalone: true,
  imports: [Tag],
  templateUrl: './queue.component.html',
  styleUrl: './queue.component.scss',
})
export class PatientQueueComponent {
  // TODO(Lim, Jereign): replace with real data in CQ-S4-4.4.02
  readonly entry = signal<SampleQueueEntry>(SAMPLE_QUEUE_ENTRY);
  // TODO(Lim, Jereign): replace with real data in CQ-S4-4.4.02
  readonly summary = signal<SampleQueueSummary>(SAMPLE_QUEUE_SUMMARY);

  readonly statusLabel = computed(() => STATUS_LABELS[this.entry().status]);

  readonly statusSeverity = computed(
    () => STATUS_SEVERITIES[this.entry().status],
  );

  readonly peopleAhead = computed(() =>
    Math.max(this.entry().positionInQueue - FIRST_POSITION, 0),
  );

  readonly isTerminal = computed(() =>
    TERMINAL_STATUSES.includes(this.entry().status),
  );

  readonly isWaiting = computed(
    () => this.entry().status === QueueStatus.WAITING,
  );

  readonly trackerSteps = computed(() => {
    const status = this.entry().status;
    const activeIndex = TRACKER_STEPS.indexOf(status);
    const isFinished = status === QueueStatus.SERVED;

    return TRACKER_STEPS.map((step, index) => {
      let state: TrackerStepState = 'upcoming';
      if (isFinished || index < activeIndex) {
        state = 'done';
      } else if (index === activeIndex) {
        state = 'current';
      }
      return { label: STATUS_LABELS[step], state };
    });
  });
}

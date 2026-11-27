import { QueueStatus } from '@prisma/client';
import { DEFAULT_SERVICE_DURATION_MINUTES } from './clinic.constants';
import {
  estimateQueueWaitMinutes,
  estimateWaitFromQueue,
  getAverageServiceDurationMinutes,
  isQueueRunningLate,
  QueueEntryForEstimate,
} from './queue-wait.util';

const MINUTE = 60_000;

const completed = (startMinutes: number, endMinutes: number) => ({
  consultationStartedAt: new Date(2026, 10, 27, 9, startMinutes),
  completedAt: new Date(2026, 10, 27, 9, endMinutes),
});

const entry = (
  status: QueueStatus,
  minutesAgo: number | null = null,
): QueueEntryForEstimate => {
  const stageStart = minutesAgo === null ? null : new Date(Date.now() - minutesAgo * MINUTE);
  return {
    status,
    calledAt: stageStart,
    consultationStartedAt: stageStart,
  };
};

describe('getAverageServiceDurationMinutes', () => {
  it('averages completed consultations and rounds up to whole minutes', () => {
    expect(
      getAverageServiceDurationMinutes([completed(0, 20), completed(30, 40)]),
    ).toBe(15);
  });

  it('withholds an average until the minimum sample count is reached', () => {
    expect(getAverageServiceDurationMinutes([completed(0, 20)], 0)).toBeNull();
  });

  it('reports unknown rather than a guess when the day has no samples', () => {
    expect(
      getAverageServiceDurationMinutes(
        [{ consultationStartedAt: null, completedAt: null }],
        0,
      ),
    ).toBeNull();
  });

  it('still honours an explicit fallback for callers that want one', () => {
    expect(
      getAverageServiceDurationMinutes([], DEFAULT_SERVICE_DURATION_MINUTES),
    ).toBe(DEFAULT_SERVICE_DURATION_MINUTES);
  });
});

describe('estimateWaitFromQueue', () => {
  it('returns null when the day has too few samples to average', () => {
    expect(estimateWaitFromQueue([entry(QueueStatus.WAITING)], null)).toBeNull();
  });

  it('charges a full average for each waiting patient ahead', () => {
    const ahead = [entry(QueueStatus.WAITING), entry(QueueStatus.WAITING)];
    expect(estimateWaitFromQueue(ahead, 5)).toBe(10);
  });

  it('charges only the remaining time for a consultation already underway', () => {
    const ahead = [
      entry(QueueStatus.IN_CONSULTATION, 3),
      entry(QueueStatus.WAITING),
    ];
    expect(estimateWaitFromQueue(ahead, 5)).toBe(7);
  });

  it('stops charging a consultation that has run past the average', () => {
    const ahead = [
      entry(QueueStatus.IN_CONSULTATION, 12),
      entry(QueueStatus.WAITING),
    ];
    expect(estimateWaitFromQueue(ahead, 5)).toBe(5);
  });

  it('reports zero when the only patient ahead has overrun', () => {
    expect(
      estimateWaitFromQueue([entry(QueueStatus.IN_CONSULTATION, 30)], 5),
    ).toBe(0);
  });

  it('charges the called patient for the grace time still owed', () => {
    expect(estimateWaitFromQueue([entry(QueueStatus.CALLED, 1)], 5)).toBe(4);
  });

  it('ignores finished entries that are still in the list', () => {
    const ahead = [
      entry(QueueStatus.COMPLETED),
      entry(QueueStatus.NO_SHOW),
      entry(QueueStatus.CANCELLED),
      entry(QueueStatus.WAITING),
    ];
    expect(estimateWaitFromQueue(ahead, 5)).toBe(5);
  });

  it('returns zero for a patient at the front with nobody ahead', () => {
    expect(estimateWaitFromQueue([], 5)).toBe(0);
  });
});

describe('isQueueRunningLate', () => {
  it('flags an overrunning consultation so the UI can explain a zero wait', () => {
    expect(isQueueRunningLate([entry(QueueStatus.IN_CONSULTATION, 20)], 5)).toBe(
      true,
    );
  });

  it('does not flag a queue that still owes time', () => {
    expect(isQueueRunningLate([entry(QueueStatus.WAITING)], 5)).toBe(false);
  });

  it('does not flag an empty queue', () => {
    expect(isQueueRunningLate([], 5)).toBe(false);
  });

  it('does not flag a queue with an unknown average', () => {
    expect(isQueueRunningLate([entry(QueueStatus.IN_CONSULTATION, 20)], null)).toBe(
      false,
    );
  });
});

describe('estimateQueueWaitMinutes', () => {
  it('does not estimate negative waits', () => {
    expect(estimateQueueWaitMinutes(-1, 15)).toBe(0);
  });

  it('scales with the number of patients ahead', () => {
    expect(estimateQueueWaitMinutes(3, 5)).toBe(15);
  });
});

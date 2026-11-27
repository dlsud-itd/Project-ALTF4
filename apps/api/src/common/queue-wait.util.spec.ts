import { DEFAULT_SERVICE_DURATION_MINUTES } from './clinic.constants';
import {
  estimateQueueWaitMinutes,
  getAverageServiceDurationMinutes,
} from './queue-wait.util';

describe('queue wait estimation', () => {
  it('uses the rolling average of valid completed service durations', () => {
    const average = getAverageServiceDurationMinutes([
      {
        consultationStartedAt: new Date('2026-11-26T09:00:00.000Z'),
        completedAt: new Date('2026-11-26T09:20:00.000Z'),
      },
      {
        consultationStartedAt: new Date('2026-11-26T09:30:00.000Z'),
        completedAt: new Date('2026-11-26T09:40:00.000Z'),
      },
    ]);

    expect(average).toBe(15);
    expect(estimateQueueWaitMinutes(2, average)).toBe(30);
  });

  it('falls back to the configured duration when there are no valid samples', () => {
    expect(
      getAverageServiceDurationMinutes([
        { consultationStartedAt: null, completedAt: null },
      ]),
    ).toBe(DEFAULT_SERVICE_DURATION_MINUTES);
  });

  it('does not estimate negative waits', () => {
    expect(estimateQueueWaitMinutes(-1, 15)).toBe(0);
  });
});

import { ClinicSlot } from '@core/models';
import {
  getSlotStatus,
  parseDateParam,
  toDateParam,
  toTimeParam,
} from './slot.util';

const buildSlot = (overrides: Partial<ClinicSlot> = {}): ClinicSlot => ({
  id: 1,
  clinicDate: '2026-11-12',
  startTime: '10:15',
  endTime: '10:45',
  capacity: 3,
  remainingCapacity: 3,
  isBookable: true,
  ...overrides,
});

describe('getSlotStatus', () => {
  it('reports open when bookable with seats left', () => {
    expect(getSlotStatus(buildSlot())).toBe('open');
  });

  it('reports full when no seats remain', () => {
    const slot = buildSlot({ remainingCapacity: 0, isBookable: false });
    expect(getSlotStatus(slot)).toBe('full');
  });

  it('reports closed when seats remain but booking is off', () => {
    expect(getSlotStatus(buildSlot({ isBookable: false }))).toBe('closed');
  });
});

describe('date helpers', () => {
  it('round-trips a date without shifting the day', () => {
    expect(toDateParam(parseDateParam('2026-11-10'))).toBe('2026-11-10');
  });

  it('formats a time as zero-padded HH:mm', () => {
    expect(toTimeParam(new Date(2026, 10, 10, 9, 5))).toBe('09:05');
  });
});

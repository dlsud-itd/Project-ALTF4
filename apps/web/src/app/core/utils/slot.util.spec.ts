import { ClinicSlot } from '@core/models';
import {
  formatTime12h,
  formatTimeRange,
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

  it('formats HH:mm strings to 12-hour format with AM/PM', () => {
    expect(formatTime12h('08:00')).toBe('08:00 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('13:30')).toBe('01:30 PM');
    expect(formatTime12h('00:15')).toBe('12:15 AM');
    expect(formatTime12h('')).toBe('');
  });

  it('formats start and end times into a readable 12-hour range', () => {
    expect(formatTimeRange('08:00', '10:00')).toBe('08:00 AM - 10:00 AM');
    expect(formatTimeRange('13:00', '14:30')).toBe('01:00 PM - 02:30 PM');
    expect(formatTimeRange('', '10:00')).toBe('');
  });
});

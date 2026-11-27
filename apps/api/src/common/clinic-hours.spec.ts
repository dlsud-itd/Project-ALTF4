import { getClinicClosedReason } from './clinic-hours';

// Builds an instant from a Manila date and time.
const manila = (date: string, time: string): Date =>
  new Date(`${date}T${time}:00+08:00`);

describe('getClinicClosedReason', () => {
  const FRIDAY = '2026-11-27';
  const SATURDAY = '2026-11-28';
  const HOLIDAY = '2026-11-30';
  const morningSlot = [{ startTime: '08:00', endTime: '08:30' }];

  it('is open during weekday clinic hours', () => {
    expect(getClinicClosedReason([], manila(FRIDAY, '08:00'))).toBeNull();
    expect(getClinicClosedReason([], manila(FRIDAY, '16:59'))).toBeNull();
  });

  it('is closed before opening and from 5 PM', () => {
    expect(getClinicClosedReason([], manila(FRIDAY, '07:59'))).toContain(
      'outside clinic hours',
    );
    expect(getClinicClosedReason([], manila(FRIDAY, '17:00'))).toContain(
      'outside clinic hours',
    );
  });

  it('is closed at lunch even with a booked slot', () => {
    const lunchSlot = [{ startTime: '12:00', endTime: '12:30' }];
    expect(
      getClinicClosedReason(lunchSlot, manila(FRIDAY, '12:15')),
    ).toContain('lunch');
  });

  it('is closed on weekends and holidays without bookings', () => {
    expect(getClinicClosedReason([], manila(SATURDAY, '09:00'))).toBe(
      'The clinic is closed today.',
    );
    expect(getClinicClosedReason([], manila(HOLIDAY, '09:00'))).toBe(
      'The clinic is closed today.',
    );
  });

  it('opens a weekend that has a booked slot, within clinic hours', () => {
    expect(
      getClinicClosedReason(morningSlot, manila(SATURDAY, '09:00')),
    ).toBeNull();
    expect(
      getClinicClosedReason(morningSlot, manila(SATURDAY, '20:00')),
    ).toContain('outside clinic hours');
  });

  it('stays open during a booked slot outside the usual hours', () => {
    const eveningSlot = [{ startTime: '18:00', endTime: '19:00' }];
    expect(
      getClinicClosedReason(eveningSlot, manila(FRIDAY, '18:30')),
    ).toBeNull();
  });
});

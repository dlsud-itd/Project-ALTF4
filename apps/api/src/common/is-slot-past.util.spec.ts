import { isSlotPast } from './is-slot-past.util';

const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const manilaDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getSlotEnd = (date: Date): { clinicDate: string; endTime: string } => {
  const parts = manilaDateTimeFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '';

  return {
    clinicDate: `${part('year')}-${part('month')}-${part('day')}`,
    endTime: `${part('hour')}:${part('minute')}`,
  };
};

describe('isSlotPast', () => {
  it('compares the end date and time in Asia/Manila', () => {
    const now = new Date();
    const pastSlot = getSlotEnd(new Date(now.getTime() - MINUTE_MS));
    const upcomingSlot = getSlotEnd(new Date(now.getTime() + MINUTE_MS));
    const nextDaySlot = getSlotEnd(new Date(now.getTime() + DAY_MS));
    const previousDaySlot = getSlotEnd(new Date(now.getTime() - DAY_MS));

    expect(isSlotPast(pastSlot.clinicDate, pastSlot.endTime, now)).toBe(true);
    expect(isSlotPast(upcomingSlot.clinicDate, upcomingSlot.endTime, now)).toBe(
      false,
    );
    expect(isSlotPast(nextDaySlot.clinicDate, nextDaySlot.endTime, now)).toBe(
      false,
    );
    expect(
      isSlotPast(previousDaySlot.clinicDate, previousDaySlot.endTime, now),
    ).toBe(true);
  });

  it('treats a slot ending exactly now as not past', () => {
    const now = new Date();
    const second = Number(
      manilaDateTimeFormatter
        .formatToParts(now)
        .find((part) => part.type === 'second')?.value ?? '0',
    );
    const exactMinute = new Date(
      now.getTime() - now.getMilliseconds() - second * SECOND_MS,
    );
    const slot = getSlotEnd(exactMinute);

    expect(isSlotPast(slot.clinicDate, slot.endTime, exactMinute)).toBe(false);
  });

  it('marks a slot past once its end minute has elapsed', () => {
    const now = new Date();
    const minuteBoundary = new Date(now.getTime() - now.getMilliseconds());
    const elapsedMinute = new Date(minuteBoundary.getTime() + SECOND_MS);
    const slot = getSlotEnd(minuteBoundary);

    expect(isSlotPast(slot.clinicDate, slot.endTime, elapsedMinute)).toBe(true);
  });
});

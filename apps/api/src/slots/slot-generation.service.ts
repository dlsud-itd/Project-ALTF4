import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getManilaCalendarDate } from '../common/is-slot-past.util';

const SLOT_MINUTES = 30;
const DEFAULT_CAPACITY = 1;
// Calendar days after today that are filled automatically. Matches the two
// weeks listed on the staff schedule page.
const ROLLING_DAYS = 14;

// Philippine regular and special non-working days with no automatic slots.
// Movable holidays change yearly, so each new year has to be added here and in
// the web app's copy (core/utils/slot.util.ts).
const HOLIDAYS: Readonly<Record<string, string>> = {
  '2026-01-01': "New Year's Day",
  '2026-02-17': 'Chinese New Year',
  '2026-03-20': "Eid'l Fitr",
  '2026-04-02': 'Maundy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-04': 'Black Saturday',
  '2026-04-09': 'Araw ng Kagitingan',
  '2026-05-01': 'Labor Day',
  '2026-06-12': 'Independence Day',
  '2026-08-21': 'Ninoy Aquino Day',
  '2026-08-31': 'National Heroes Day',
  '2026-11-01': "All Saints' Day",
  '2026-11-02': "All Souls' Day",
  '2026-11-30': 'Bonifacio Day',
  '2026-12-08': 'Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day',
  '2026-12-31': 'Last Day of the Year',
  '2027-01-01': "New Year's Day",
};

// Clinic hours in Asia/Manila time. Lunch 12:00-13:00 is not generated.
const DAILY_WINDOWS: readonly { start: string; end: string }[] = [
  { start: '08:00', end: '12:00' },
  { start: '13:00', end: '17:00' },
];

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Builds every half-hour slot between the start and end of a window.
const buildWindowSlots = (
  window: { start: string; end: string },
): { startTime: string; endTime: string }[] => {
  const slots: { startTime: string; endTime: string }[] = [];
  for (
    let cursor = toMinutes(window.start);
    cursor + SLOT_MINUTES <= toMinutes(window.end);
    cursor += SLOT_MINUTES
  ) {
    slots.push({
      startTime: toTime(cursor),
      endTime: toTime(cursor + SLOT_MINUTES),
    });
  }
  return slots;
};

export const DEFAULT_DAY_SLOTS: readonly { startTime: string; endTime: string }[] =
  DAILY_WINDOWS.flatMap(buildWindowSlots);

// Returns the weekdays (YYYY-MM-DD) from today through dayCount days ahead.
export const getUpcomingWeekdayDates = (
  dayCount: number = ROLLING_DAYS,
  now: Date = new Date(),
): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${getManilaCalendarDate(now)}T00:00:00.000Z`);

  for (let offset = 0; offset <= dayCount; offset += 1) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

@Injectable()
export class SlotGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  // Fills each weekday in the window with the default slots, around any that
  // already exist. Existing rows are never modified, so staff blocks and
  // manually added slots survive regeneration.
  async ensureUpcomingSlots(
    dayCount: number = ROLLING_DAYS,
    now: Date = new Date(),
  ) {
    const dates = getUpcomingWeekdayDates(dayCount, now).filter(
      (date) => !(date in HOLIDAYS),
    );

    const existing = await this.prisma.clinicSlot.findMany({
      where: { clinicDate: { in: dates.map((date) => new Date(`${date}T00:00:00.000Z`)) } },
      select: { clinicDate: true, startTime: true, endTime: true },
    });

    // A default slot is left out if it overlaps one already on that date.
    const isTaken = (
      date: string,
      candidate: { startTime: string; endTime: string },
    ): boolean =>
      existing.some(
        (slot) =>
          slot.clinicDate.toISOString().slice(0, 10) === date &&
          slot.startTime < candidate.endTime &&
          slot.endTime > candidate.startTime,
      );

    const rows = dates.flatMap((date) =>
      DEFAULT_DAY_SLOTS.filter((slot) => !isTaken(date, slot)).map((slot) => ({
        clinicDate: new Date(`${date}T00:00:00.000Z`),
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: DEFAULT_CAPACITY,
        isBookable: true,
      })),
    );

    if (rows.length === 0) {
      return { generated: 0, days: dates.length };
    }

    await this.prisma.clinicSlot.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return { generated: rows.length, days: dates.length };
  }
}

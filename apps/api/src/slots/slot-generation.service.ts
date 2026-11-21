import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getManilaCalendarDate } from '../common/is-slot-past.util';

const SLOT_MINUTES = 30;
const DEFAULT_CAPACITY = 1;
const ROLLING_DAYS = 14;

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

// Returns the YYYY-MM-DD dates of the rolling window, skipping weekends.
export const getUpcomingWeekdayDates = (
  dayCount: number = ROLLING_DAYS,
  now: Date = new Date(),
): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${getManilaCalendarDate(now)}T00:00:00.000Z`);

  while (dates.length < dayCount) {
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

  // Creates the default slots for every upcoming weekday that has none yet.
  // Existing rows are never modified, so staff blocks survive regeneration.
  async ensureUpcomingSlots(
    dayCount: number = ROLLING_DAYS,
    now: Date = new Date(),
  ) {
    const dates = getUpcomingWeekdayDates(dayCount, now);

    const existing = await this.prisma.clinicSlot.findMany({
      where: { clinicDate: { in: dates.map((date) => new Date(`${date}T00:00:00.000Z`)) } },
      select: { clinicDate: true, startTime: true },
    });

    const taken = new Set(
      existing.map(
        (slot) =>
          `${slot.clinicDate.toISOString().slice(0, 10)}|${slot.startTime}`,
      ),
    );

    const rows = dates.flatMap((date) =>
      DEFAULT_DAY_SLOTS.filter(
        (slot) => !taken.has(`${date}|${slot.startTime}`),
      ).map((slot) => ({
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

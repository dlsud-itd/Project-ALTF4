import { AppointmentStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { HOLIDAYS } from '../slots/slot-generation.service';
import { getManilaDateTime } from './is-slot-past.util';

type TimeRange = { startTime: string; endTime: string };

const CLINIC_WINDOWS: readonly TimeRange[] = [
  { startTime: '08:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '17:00' },
];
const LUNCH: TimeRange = { startTime: '12:00', endTime: '13:00' };

const isWithin = (time: string, range: TimeRange): boolean =>
  time >= range.startTime && time < range.endTime;

// Why patients cannot be called right now (Manila time), or null when the
// clinic is open. A booked slot opens a weekend or holiday for the day, and
// also covers its own hours outside the usual ones. Lunch is always closed.
export const getClinicClosedReason = (
  bookedSlots: readonly TimeRange[],
  now: Date = new Date(),
): string | null => {
  const [date, clock] = getManilaDateTime(now).split('T');
  const time = clock.slice(0, 5);

  if (isWithin(time, LUNCH)) {
    return 'The clinic is closed for lunch (12:00 PM to 1:00 PM).';
  }
  if (bookedSlots.some((slot) => isWithin(time, slot))) {
    return null;
  }

  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const isRegularDay = weekday !== 0 && weekday !== 6 && !(date in HOLIDAYS);
  if (!isRegularDay && bookedSlots.length === 0) {
    return 'The clinic is closed today.';
  }
  return CLINIC_WINDOWS.some((window) => isWithin(time, window))
    ? null
    : 'It is outside clinic hours (8:00 AM to 12:00 PM and 1:00 PM to 5:00 PM).';
};

// Looks up today's booked slots, then applies the rules above. Finished visits
// still count, so a booked day stays open after its patients are seen.
export const findClinicClosedReason = async (
  prisma: PrismaService,
  now: Date = new Date(),
): Promise<string | null> => {
  const today = getManilaDateTime(now).slice(0, 10);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { not: AppointmentStatus.CANCELLED },
      slot: { clinicDate: new Date(`${today}T00:00:00.000Z`) },
    },
    select: { slot: { select: { startTime: true, endTime: true } } },
  });
  return getClinicClosedReason(
    appointments.map((appointment) => appointment.slot),
    now,
  );
};

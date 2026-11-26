import { ClinicSlot, SlotStatus } from '@core/models';

// A slot that has been blocked is closed even if it still has free seats.
export const getSlotStatus = (slot: ClinicSlot): SlotStatus => {
  if (slot.isExpired) {
    return 'expired';
  }
  if (slot.isOpen === false) {
    return 'closed';
  }
  return slot.remainingCapacity > 0 ? 'open' : 'full';
};

// Formats a Date as YYYY-MM-DD in local time, the format the slots API uses.
export const toDateParam = (date: Date): string => {
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

// Parses YYYY-MM-DD as a local-midnight Date, the inverse of toDateParam.
export const parseDateParam = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Formats a Date as HH:mm in local time, the format slot times use.
export const toTimeParam = (date: Date): string => {
  const hours: string = String(date.getHours()).padStart(2, '0');
  const minutes: string = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Formats an HH:mm time string into a 12-hour format with AM/PM (e.g. "09:00" -> "09:00 AM", "14:30" -> "02:30 PM").
export const formatTime12h = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hoursStr, minsStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${minsStr} ${period}`;
};

// Formats start and end times into a readable 12-hour range (e.g. "09:00 AM - 10:00 AM").
export const formatTimeRange = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return '';
  return `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
};

// How far ahead staff can view and manage slots.
const MAX_MONTHS_AHEAD = 3;

// The last date staff can schedule, three months from today. A shorter target
// month clamps to its last day, so Nov 30 gives Feb 28 and not Mar 2.
export const latestScheduleDate = (now: Date = new Date()): Date => {
  const year: number = now.getFullYear();
  const month: number = now.getMonth() + MAX_MONTHS_AHEAD;
  const lastDayOfMonth: number = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(now.getDate(), lastDayOfMonth));
};

// Philippine regular and special non-working days when the clinic is closed.
// Movable holidays change yearly, so each new year has to be added here and in
// the API's copy (slot-generation.service.ts).
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

// The holiday's name for a YYYY-MM-DD date, or null on an ordinary day.
export const getHolidayName = (date: string): string | null =>
  HOLIDAYS[date] ?? null;

// Local-midnight dates, for disabling holidays in date pickers.
export const getHolidayDates = (): Date[] =>
  Object.keys(HOLIDAYS).map(parseDateParam);

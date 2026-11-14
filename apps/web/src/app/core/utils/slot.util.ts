import { ClinicSlot, SlotStatus } from '@core/models';

// Full wins over closed because the API folds "no seats left" into isBookable.
export const getSlotStatus = (slot: ClinicSlot): SlotStatus => {
  if (slot.remainingCapacity <= 0) {
    return 'full';
  }
  return slot.isBookable ? 'open' : 'closed';
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

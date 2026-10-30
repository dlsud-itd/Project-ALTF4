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

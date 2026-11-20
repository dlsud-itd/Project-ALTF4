const MANILA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export const getManilaDateTime = (now: Date = new Date()): string => {
  const manilaParts = MANILA_DATE_TIME_FORMATTER.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    manilaParts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
};

export const getManilaCalendarDate = (now: Date = new Date()): string =>
  getManilaDateTime(now).slice(0, 10);

export const isSlotPast = (
  clinicDate: Date | string,
  endTime: string,
  now: Date = new Date(),
): boolean => {
  const date =
    clinicDate instanceof Date
      ? clinicDate.toISOString().slice(0, 10)
      : clinicDate;
  const currentDateTime = getManilaDateTime(now);
  return `${date}T${endTime}:00` < currentDateTime;
};

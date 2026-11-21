import { BadRequestException } from '@nestjs/common';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

// Parses YYYY-MM-DD as UTC midnight so a date column keeps the picked day
// regardless of the server timezone.
export const toUtcDate = (value: string, fieldName: string): Date => {
  if (!DATE_FORMAT.test(value)) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${fieldName} must be a valid calendar date`);
  }

  return date;
};

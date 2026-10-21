import { HttpErrorResponse } from '@angular/common/http';

type ErrorBody = { message?: string | string[] };

export const getErrorMessage = (error: HttpErrorResponse, fallback: string): string => {
  if (error.status === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  const body: ErrorBody | null =
    typeof error.error === 'object' ? (error.error as ErrorBody | null) : null;
  const message: string | string[] | undefined = body?.message;
  if (Array.isArray(message)) {
    return message.join(' ');
  }
  return message ?? fallback;
};
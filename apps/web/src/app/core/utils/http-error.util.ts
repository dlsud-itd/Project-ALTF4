import { HttpErrorResponse } from '@angular/common/http';

// Expected JSON structure of error responses from backend API endpoints.
type ErrorBody = {
  message?: string | string[];
  error?: string;
};

// Extracts a human-readable error description from an HttpErrorResponse or falls back to a default message.
export const getErrorMessage = (error: HttpErrorResponse, fallback: string): string => {
  if (error.status === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  const body: ErrorBody | null =
    typeof error.error === 'object' && error.error !== null
      ? (error.error as ErrorBody)
      : null;
  const message: string | string[] | undefined = body?.message;
  if (Array.isArray(message)) {
    return message.join(' ');
  }
  const errorMsg: string | undefined = typeof body?.error === 'string' ? body.error : undefined;
  return message ?? errorMsg ?? fallback;
};
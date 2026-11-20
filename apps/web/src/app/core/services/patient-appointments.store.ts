import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import { PatientAppointment } from '../models';
import { getErrorMessage } from '../utils';
import { AppointmentsService } from './appointments.service';

const LOAD_ERROR_FALLBACK = 'Could not load your appointments.';

type LoadResult =
  | { appointments: PatientAppointment[] }
  | { errorMessage: string };

// Picks the earliest upcoming booked appointment; all patient queue displays use this selector.
export const selectActiveQueueEntry = (
  appointments: PatientAppointment[],
): PatientAppointment | null =>
  appointments
    .filter(
      (appointment) =>
        appointment.status === 'BOOKED' &&
        !appointment.slot.isExpired,
    )
    .sort(
      (left, right) =>
        left.slot.clinicDate.localeCompare(right.slot.clinicDate) ||
        left.slot.startTime.localeCompare(right.slot.startTime),
    )[0] ?? null;

@Injectable({ providedIn: 'root' })
export class PatientAppointmentsStore {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloadRequests = new Subject<void>();

  readonly appointments = signal<PatientAppointment[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeQueueEntry = computed(() =>
    selectActiveQueueEntry(this.appointments()),
  );

  constructor() {
    this.reloadRequests
      .pipe(
        switchMap(() =>
          this.appointmentsService.getMyAppointments().pipe(
            map(
              (response): LoadResult => ({
                appointments: response.appointments ?? [],
              }),
            ),
            catchError((error: unknown) =>
              of<LoadResult>({
                errorMessage:
                  error instanceof HttpErrorResponse
                    ? getErrorMessage(error, LOAD_ERROR_FALLBACK)
                    : LOAD_ERROR_FALLBACK,
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.isLoading.set(false);
        if ('errorMessage' in result) {
          this.error.set(result.errorMessage);
          return;
        }
        this.error.set(null);
        this.appointments.set(result.appointments);
      });
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.reloadRequests.next();
  }
}

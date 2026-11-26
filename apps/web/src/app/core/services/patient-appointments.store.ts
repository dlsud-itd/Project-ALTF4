import { HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  ACTIVE_QUEUE_STATUSES,
} from '../config/clinic.constants';
import { PatientAppointment, ReservedQueueEntry } from '../models';
import { getErrorMessage } from '../utils';
import { AppointmentsService } from './appointments.service';

const LOAD_ERROR_FALLBACK = 'Could not load your appointments.';

type LoadResult =
  | {
      appointments: PatientAppointment[];
      activeBookingCount: number;
      maxActiveBookings: number;
    }
  | { errorMessage: string };

export type ActiveQueueAppointmentEntry = {
  appointment: PatientAppointment;
  queueEntry: ReservedQueueEntry;
};

// Picks the earliest upcoming booked appointment; all patient queue displays use this selector.
export const selectActiveQueueEntry = (
  appointments: PatientAppointment[],
): PatientAppointment | null =>
  appointments
    .filter(
      (appointment) =>
        appointment.status === 'BOOKED' && !appointment.slot.isExpired,
    )
    .sort(
      (left, right) =>
        left.slot.clinicDate.localeCompare(right.slot.clinicDate) ||
        left.slot.startTime.localeCompare(right.slot.startTime),
    )[0] ?? null;

export const selectActiveQueueEntries = (
  appointments: PatientAppointment[],
): ActiveQueueAppointmentEntry[] =>
  appointments
    .filter(
      (appointment) =>
        ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status) &&
        !appointment.slot.isExpired,
    )
    .flatMap((appointment) => {
      const entries =
        appointment.reservedQueueEntries ??
        (appointment.reservedQueueEntry
          ? [appointment.reservedQueueEntry]
          : []);
      return entries
        .filter(
          (entry) =>
            !entry.status || ACTIVE_QUEUE_STATUSES.includes(entry.status),
        )
        .map((queueEntry) => ({ appointment, queueEntry }));
    })
    .sort(
      (left, right) =>
        left.appointment.slot.clinicDate.localeCompare(
          right.appointment.slot.clinicDate,
        ) ||
        left.appointment.slot.startTime.localeCompare(
          right.appointment.slot.startTime,
        ) ||
        left.queueEntry.queueNumber - right.queueEntry.queueNumber,
    );

@Injectable({ providedIn: 'root' })
export class PatientAppointmentsStore {
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloadRequests = new Subject<void>();
  private requestInFlight = false;

  readonly appointments = signal<PatientAppointment[]>([]);
  readonly activeBookingCount = signal<number | null>(null);
  readonly maxActiveBookings = signal<number | null>(null);
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
            map((response): LoadResult => ({
              appointments: response.appointments ?? [],
              activeBookingCount: response.activeBookingCount,
              maxActiveBookings: response.maxActiveBookings,
            })),
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
        this.requestInFlight = false;
        this.isLoading.set(false);
        if ('errorMessage' in result) {
          this.error.set(result.errorMessage);
          return;
        }
        this.error.set(null);
        this.appointments.set(result.appointments);
        this.activeBookingCount.set(result.activeBookingCount);
        this.maxActiveBookings.set(result.maxActiveBookings);
      });
  }

  load(): void {
    this.requestInFlight = true;
    this.isLoading.set(true);
    this.error.set(null);
    this.reloadRequests.next();
  }

  refresh(): void {
    if (this.requestInFlight) {
      return;
    }
    this.requestInFlight = true;
    this.reloadRequests.next();
  }
}

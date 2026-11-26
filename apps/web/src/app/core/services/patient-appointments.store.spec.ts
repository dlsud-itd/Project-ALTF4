import { PatientAppointment, QueueStatus } from '../models';
import {
  selectActiveQueueEntries,
  selectActiveQueueEntry,
} from './patient-appointments.store';

const appointment = (
  id: number,
  clinicDate: string,
  startTime: string,
  overrides: Partial<PatientAppointment> = {},
): PatientAppointment => ({
  id,
  status: 'BOOKED',
  createdAt: '2026-11-01T00:00:00.000Z',
  slot: {
    id,
    clinicDate,
    startTime,
    endTime: '10:30',
    capacity: 2,
    remainingCapacity: 1,
    isBookable: true,
    isExpired: false,
  },
  reservedQueueEntry: {
    ticketNumber: `A-${String(id).padStart(3, '0')}`,
    queueNumber: id,
    positionInQueue: id,
    estimatedWaitMinutes: id * 10,
  },
  ...overrides,
});

describe('selectActiveQueueEntry', () => {
  it('selects the earliest non-expired booked appointment by date and start time', () => {
    const later = appointment(3, '2026-11-22', '09:00');
    const earliest = appointment(2, '2026-11-21', '10:00');
    const sameDayEarlier = appointment(1, '2026-11-21', '08:30');
    const expired = appointment(4, '2026-11-21', '07:00', {
      slot: {
        ...appointment(4, '2026-11-21', '07:00').slot,
        isExpired: true,
      },
    });

    expect(
      selectActiveQueueEntry([later, earliest, expired, sameDayEarlier]),
    ).toBe(sameDayEarlier);
  });

  it('ignores cancelled appointments and keeps the earliest booked appointment as primary', () => {
    const cancelled = appointment(1, '2026-11-21', '08:00', {
      status: 'CANCELLED',
    });
    const noTicket = appointment(2, '2026-11-21', '09:00', {
      reservedQueueEntry: null,
    });

    expect(selectActiveQueueEntry([cancelled, noTicket])).toBe(noTicket);
  });
});

describe('selectActiveQueueEntries', () => {
  it('returns every active ticket and excludes terminal or finished appointments', () => {
    const active = appointment(1, '2026-11-21', '08:00', {
      reservedQueueEntries: [
        {
          id: 11,
          ticketNumber: 'A-011',
          queueNumber: 11,
          status: QueueStatus.WAITING,
          positionInQueue: 2,
          estimatedWaitMinutes: 15,
        },
        {
          id: 12,
          ticketNumber: 'A-012',
          queueNumber: 12,
          status: QueueStatus.IN_CONSULTATION,
          positionInQueue: 1,
          estimatedWaitMinutes: 0,
        },
        {
          id: 13,
          ticketNumber: 'A-013',
          queueNumber: 13,
          status: QueueStatus.COMPLETED,
          positionInQueue: 1,
          estimatedWaitMinutes: 0,
        },
      ],
    });
    const completed = appointment(2, '2026-11-21', '09:00', {
      status: 'COMPLETED',
    });

    expect(
      selectActiveQueueEntries([active, completed]).map(
        ({ queueEntry }) => queueEntry.ticketNumber,
      ),
    ).toEqual(['A-011', 'A-012']);
  });
});

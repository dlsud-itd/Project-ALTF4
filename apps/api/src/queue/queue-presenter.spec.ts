import { QueueStatus } from '@prisma/client';
import { presentServingTicket, presentWaitingTicket } from './queue-presenter';

describe('queue patient presenters', () => {
  it('exposes only ticket status fields to patients', () => {
    const result = presentWaitingTicket(
      {
        id: 8,
        ticketNumber: 'A-008',
        status: QueueStatus.WAITING,
        firstName: 'Patient Name',
        reasonForVisit: 'Private reason',
        notes: 'Private administrative note',
        phoneNumber: 'Private phone',
      },
      false,
    );

    expect(result).toEqual({
      queue_entry_id: 8,
      ticket_number: 'A-008',
      status: QueueStatus.WAITING,
    });
    expect(result).not.toHaveProperty('notes');
    expect(result).not.toHaveProperty('phoneNumber');
  });

  it('omits patient details and private notes from a patient serving response', () => {
    const result = presentServingTicket(
      {
        id: 8,
        ticketNumber: 'A-008',
        status: QueueStatus.CALLED,
        calledAt: new Date('2026-11-06T09:00:00.000Z'),
        graceExpiresAt: new Date('2026-11-06T09:03:00.000Z'),
        roomNumber: 'Counter 1',
        provider: 'Clinic staff',
        firstName: 'Patient Name',
        reasonForVisit: 'Private reason',
        notes: 'Private consultation note',
      },
      false,
    );

    expect(result).not.toHaveProperty('patient_name');
    expect(result).not.toHaveProperty('reason_for_visit');
    expect(result).not.toHaveProperty('notes');
  });
});

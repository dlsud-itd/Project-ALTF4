import { NotificationType, QueueStatus } from '@prisma/client';
import {
  buildNotificationPayload,
  NOTIFICATION_EVENT_RULES,
  NotificationEvent,
  NotificationRecipientRole,
} from './notification-events';

describe('notification event rules', () => {
  const appointmentContext = {
    appointmentId: 31,
    appointmentDate: '2026-11-21',
    appointmentTime: '09:30',
    reasonForVisit: 'FORBIDDEN_REASON',
    diagnosis: 'FORBIDDEN_DIAGNOSIS',
    patientName: 'FORBIDDEN_NAME',
  };
  const queueStatusContext = {
    queueEntryId: 41,
    ticketNumber: 'A-041',
    status: QueueStatus.CALLED,
    reasonForVisit: 'FORBIDDEN_REASON',
    diagnosis: 'FORBIDDEN_DIAGNOSIS',
    patientName: 'FORBIDDEN_NAME',
  };
  const approachingTurnContext = {
    queueEntryId: 41,
    ticketNumber: 'A-041',
    reasonForVisit: 'FORBIDDEN_REASON',
    diagnosis: 'FORBIDDEN_DIAGNOSIS',
    patientName: 'FORBIDDEN_NAME',
  };
  const queueCallContext = {
    queueEntryId: 41,
    ticketNumber: 'A-041',
    roomNumber: 'Room 1',
    reasonForVisit: 'FORBIDDEN_REASON',
    diagnosis: 'FORBIDDEN_DIAGNOSIS',
    patientName: 'FORBIDDEN_NAME',
  };
  const events: NotificationEvent[] = [
    {
      type: NotificationType.BOOKING_CONFIRMATION,
      context: appointmentContext,
    },
    {
      type: NotificationType.BOOKING_CANCELLATION,
      context: appointmentContext,
    },
    {
      type: NotificationType.BOOKING_RESCHEDULE,
      context: appointmentContext,
    },
    {
      type: NotificationType.QUEUE_STATUS_UPDATE,
      context: queueStatusContext,
    },
    {
      type: NotificationType.APPROACHING_TURN,
      context: approachingTurnContext,
    },
    {
      type: NotificationType.QUEUE_CALL,
      context: queueCallContext,
    },
  ];

  it('defines a recipient rule, title, and message builder for every event', () => {
    expect(Object.keys(NOTIFICATION_EVENT_RULES).sort()).toEqual(
      events.map((event) => event.type).sort(),
    );

    for (const event of events) {
      const rule = NOTIFICATION_EVENT_RULES[event.type];
      expect(rule.recipients.length).toBeGreaterThan(0);
      expect(
        rule.recipients.every(
          (role) =>
            role === NotificationRecipientRole.PATIENT ||
            role === NotificationRecipientRole.STAFF,
        ),
      ).toBe(true);
      expect(rule.title).toBeTruthy();
      expect(typeof rule.message).toBe('function');
      expect(rule.referenceFields.length).toBeGreaterThan(0);
    }
  });

  it('does not render forbidden fields or values in any event template', () => {
    const forbiddenFields = [
      'reasonForVisit',
      'diagnosis',
      'patientName',
      'fullName',
      'phoneNumber',
    ];
    const forbiddenValues = [
      'FORBIDDEN_REASON',
      'FORBIDDEN_DIAGNOSIS',
      'FORBIDDEN_NAME',
    ];

    for (const event of events) {
      const payload = buildNotificationPayload(event);
      const rendered = JSON.stringify(payload);
      const rule = NOTIFICATION_EVENT_RULES[event.type];

      for (const forbiddenValue of forbiddenValues) {
        expect(rendered).not.toContain(forbiddenValue);
      }
      for (const forbiddenField of forbiddenFields) {
        expect(rule.message.toString()).not.toContain(forbiddenField);
      }
    }
  });

  it('includes only the reference fields defined for each event', () => {
    expect(buildNotificationPayload(events[0])).toMatchObject({
      type: NotificationType.BOOKING_CONFIRMATION,
      appointmentId: 31,
    });
    expect(buildNotificationPayload(events[3])).toMatchObject({
      type: NotificationType.QUEUE_STATUS_UPDATE,
      queueEntryId: 41,
    });
  });
});

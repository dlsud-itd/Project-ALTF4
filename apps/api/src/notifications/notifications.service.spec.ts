import { NotFoundException } from '@nestjs/common';
import {
  AccessRole,
  Notification,
  NotificationType,
  Prisma,
  QueueStatus,
} from '@prisma/client';
import { firstValueFrom, take } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannelService } from './channels/email-channel.service';
import { SmsChannelService } from './channels/sms-channel.service';
import {
  buildNotificationPayload,
  NotificationEvent,
  NotificationRecipientRole,
} from './notification-events';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const mockPrisma = {
    user: {
      findMany: jest.fn<
        Promise<
          {
            id: number;
            email?: string;
            fullName?: string;
            phoneNumber?: string | null;
            role?: AccessRole;
          }[]
        >,
        [Prisma.UserFindManyArgs]
      >(),
    },
    notification: {
      createMany: jest.fn<
        Promise<Prisma.BatchPayload>,
        [Prisma.NotificationCreateManyArgs]
      >(),
      findMany: jest.fn<
        Promise<Notification[]>,
        [Prisma.NotificationFindManyArgs]
      >(),
      count: jest.fn<Promise<number>, [Prisma.NotificationCountArgs]>(),
      findFirst: jest.fn<
        Promise<Notification | null>,
        [Prisma.NotificationFindFirstArgs]
      >(),
      updateMany: jest.fn<
        Promise<Prisma.BatchPayload>,
        [Prisma.NotificationUpdateManyArgs]
      >(),
    },
  };
  let service: NotificationsService;

  const notification: Notification = {
    id: 12,
    userId: 7,
    type: NotificationType.BOOKING_CONFIRMATION,
    title: 'Booking confirmed',
    message: 'Your appointment is confirmed for 2026-11-21 at 09:30.',
    appointmentId: 31,
    queueEntryId: null,
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-11-20T08:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(mockPrisma as unknown as PrismaService);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });
  });

  const roleEventCases: {
    event: NotificationEvent;
    recipientRoles: NotificationRecipientRole[];
  }[] = [
    {
      event: {
        type: NotificationType.BOOKING_CONFIRMATION,
        context: {
          appointmentId: 31,
          appointmentDate: '2026-11-21',
          appointmentTime: '09:30',
        },
      },
      recipientRoles: [NotificationRecipientRole.PATIENT],
    },
    {
      event: {
        type: NotificationType.BOOKING_CANCELLATION,
        context: {
          appointmentId: 31,
          appointmentDate: '2026-11-21',
          appointmentTime: '09:30',
        },
      },
      recipientRoles: [
        NotificationRecipientRole.PATIENT,
        NotificationRecipientRole.STAFF,
      ],
    },
    {
      event: {
        type: NotificationType.BOOKING_RESCHEDULE,
        context: {
          appointmentId: 31,
          appointmentDate: '2026-11-22',
          appointmentTime: '10:00',
        },
      },
      recipientRoles: [
        NotificationRecipientRole.PATIENT,
        NotificationRecipientRole.STAFF,
      ],
    },
    {
      event: {
        type: NotificationType.QUEUE_STATUS_UPDATE,
        context: {
          queueEntryId: 41,
          ticketNumber: 'A-041',
          status: QueueStatus.CALLED,
        },
      },
      recipientRoles: [NotificationRecipientRole.PATIENT],
    },
    {
      event: {
        type: NotificationType.APPROACHING_TURN,
        context: { queueEntryId: 41, ticketNumber: 'A-041' },
      },
      recipientRoles: [NotificationRecipientRole.PATIENT],
    },
    {
      event: {
        type: NotificationType.QUEUE_CALL,
        context: {
          queueEntryId: 41,
          ticketNumber: 'A-041',
          roomNumber: 'Room 1',
        },
      },
      recipientRoles: [NotificationRecipientRole.PATIENT],
    },
  ];

  it.each(roleEventCases)(
    'creates for only the allowed roles for $event.type',
    async (eventCase) => {
      const isPatientAllowed = eventCase.recipientRoles.includes(
        NotificationRecipientRole.PATIENT,
      );
      const isStaffAllowed = eventCase.recipientRoles.includes(
        NotificationRecipientRole.STAFF,
      );
      const allowedUsers = [
        ...(isPatientAllowed ? [{ id: 7 }] : []),
        ...(isStaffAllowed ? [{ id: 8 }] : []),
      ];
      mockPrisma.user.findMany.mockResolvedValue(allowedUsers);
      mockPrisma.notification.createMany.mockResolvedValue({
        count: allowedUsers.length,
      });

      const count = await service.createForRecipients(eventCase.event, {
        [NotificationRecipientRole.PATIENT]: [7],
        [NotificationRecipientRole.STAFF]: [8],
      });

      expect(count).toBe(allowedUsers.length);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [
              ...(isPatientAllowed ? [7] : []),
              ...(isStaffAllowed ? [8] : []),
            ],
          },
          role: { in: eventCase.recipientRoles },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phoneNumber: true,
          role: true,
        },
      });
      const payload = buildNotificationPayload(eventCase.event);
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: allowedUsers.map(({ id }) => ({ ...payload, userId: id })),
      });
    },
  );

  it('does not query or create when there are no eligible recipient IDs', async () => {
    const count = await service.createForRecipients(
      {
        type: NotificationType.BOOKING_CONFIRMATION,
        context: {
          appointmentId: 31,
          appointmentDate: '2026-11-21',
          appointmentTime: '09:30',
        },
      },
      { [NotificationRecipientRole.STAFF]: [8] },
    );

    expect(count).toBe(0);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('lists only the authenticated user notifications with unread count', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([notification]);
    mockPrisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const query = {
      page: 1,
      limit: 20,
      unreadOnly: undefined,
    };

    const result = await service.listForUser(7, query);

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7 },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
      }),
    );
    expect(result).toMatchObject({
      notifications: [{ id: 12, isRead: false }],
      unreadCount: 2,
      totalCount: 1,
    });
    expect(result.notifications[0]).not.toHaveProperty('userId');
  });

  it('applies the unread-only filter while counting all unread notifications', async () => {
    mockPrisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const result = await service.listForUser(7, {
      page: 2,
      limit: 10,
      unreadOnly: 'true',
    });

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, isRead: false },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.totalCount).toBe(1);
    expect(result.unreadCount).toBe(2);
  });

  it('returns the authenticated user unread count', async () => {
    mockPrisma.notification.count.mockResolvedValue(3);

    await expect(service.getUnreadCount(7)).resolves.toEqual({
      unreadCount: 3,
    });
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 7, isRead: false },
    });
  });

  it('sets readAt when marking an unread notification as read', async () => {
    const updatedNotification = {
      ...notification,
      isRead: true,
      readAt: new Date('2026-11-20T08:15:00.000Z'),
    };
    mockPrisma.notification.findFirst
      .mockResolvedValueOnce(notification)
      .mockResolvedValueOnce(updatedNotification);

    const result = await service.markAsRead(7, notification.id);

    const updateData = mockPrisma.notification.updateMany.mock.calls[0][0].data;
    expect(updateData.isRead).toBe(true);
    expect(updateData.readAt).toBeInstanceOf(Date);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 7, id: notification.id, isRead: false },
      data: updateData,
    });
    expect(result.isRead).toBe(true);
    expect(result.readAt).toEqual(updatedNotification.readAt);
  });

  it('does not overwrite readAt when marking an already-read notification', async () => {
    const originalReadAt = new Date('2026-11-20T08:15:00.000Z');
    mockPrisma.notification.findFirst.mockResolvedValue({
      ...notification,
      isRead: true,
      readAt: originalReadAt,
    });

    const result = await service.markAsRead(7, notification.id);

    expect(result.readAt).toEqual(originalReadAt);
    expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.notification.findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the notification does not exist', async () => {
    await expect(service.markAsRead(7, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the same 404 when the notification belongs to another user', async () => {
    await expect(service.markAsRead(7, notification.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith({
      where: { userId: 7, id: notification.id },
    });
  });

  it('marks only the authenticated user unread notifications as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.markAllAsRead(7)).resolves.toEqual({
      updatedCount: 2,
    });
    const updateData = mockPrisma.notification.updateMany.mock.calls[0][0].data;
    expect(updateData.isRead).toBe(true);
    expect(updateData.readAt).toBeInstanceOf(Date);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 7, isRead: false },
      data: updateData,
    });
  });

  it('dispatches email, patient SMS, and SSE stream events when channels are enabled', async () => {
    const emailChannel = {
      isEnabled: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(true),
    };
    const smsChannel = {
      isEnabled: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(true),
    };
    const channelService = new NotificationsService(
      mockPrisma as unknown as PrismaService,
      emailChannel as unknown as EmailChannelService,
      smsChannel as unknown as SmsChannelService,
    );

    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 7,
        email: 'patient@dlsud.edu.ph',
        fullName: 'Juan Dela Cruz',
        phoneNumber: '+639171234567',
        role: AccessRole.PATIENT,
      },
      {
        id: 8,
        email: 'staff@dlsud.edu.ph',
        fullName: 'Nurse Jane',
        phoneNumber: '+639179999999',
        role: AccessRole.STAFF,
      },
    ]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

    const streamPromise = firstValueFrom(
      channelService.getUserNotificationStream(7).pipe(take(1)),
    );

    await channelService.createForRecipients(
      {
        type: NotificationType.BOOKING_CANCELLATION,
        context: {
          appointmentId: 31,
          appointmentDate: '2026-11-28',
          appointmentTime: '09:30',
        },
      },
      {
        [NotificationRecipientRole.PATIENT]: [7],
        [NotificationRecipientRole.STAFF]: [8],
      },
    );

    const streamEvent = await streamPromise;
    expect(streamEvent.type).toBe('notification:created');
    await new Promise((resolve) => setImmediate(resolve));

    expect(emailChannel.send).toHaveBeenCalledTimes(2);
    expect(smsChannel.send).toHaveBeenCalledTimes(1);
    expect(smsChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+639171234567',
        type: NotificationType.BOOKING_CANCELLATION,
      }),
    );
  });
});

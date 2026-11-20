import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessRole, Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildNotificationPayload,
  NOTIFICATION_EVENT_RULES,
  NotificationEvent,
  NotificationRecipientRole,
} from './notification-events';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationResponseDto,
  NotificationsListResponseDto,
} from './dto/notification-response.dto';

export interface NotificationRecipientIds {
  [NotificationRecipientRole.PATIENT]?: readonly number[];
  [NotificationRecipientRole.STAFF]?: readonly number[];
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForRecipients(
    event: NotificationEvent,
    recipientIdsByRole: NotificationRecipientIds,
  ): Promise<number> {
    const allowedRoles: readonly NotificationRecipientRole[] =
      NOTIFICATION_EVENT_RULES[event.type].recipients;
    const requestedIds = [
      ...new Set(
        allowedRoles.flatMap((role) => recipientIdsByRole[role] ?? []),
      ),
    ];

    if (requestedIds.length === 0) {
      return 0;
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        id: { in: requestedIds },
        role: {
          in: allowedRoles.map((role) =>
            role === NotificationRecipientRole.PATIENT
              ? AccessRole.PATIENT
              : AccessRole.STAFF,
          ),
        },
      },
      select: { id: true },
    });

    if (recipients.length === 0) {
      return 0;
    }

    const payload = buildNotificationPayload(event);
    const result = await this.prisma.notification.createMany({
      data: recipients.map(({ id }) => ({ ...payload, userId: id })),
    });
    return result.count;
  }

  async listForUser(
    userId: number,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationsListResponseDto> {
    const where: Prisma.NotificationWhereInput = {
      ...this.userScopeFilter(userId),
      ...(query.unreadOnly === 'true' ? { isRead: false } : {}),
    };
    const [notifications, totalCount, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...this.userScopeFilter(userId), isRead: false },
      }),
    ]);

    return {
      notifications: notifications.map((notification) =>
        this.toResponseDto(notification),
      ),
      unreadCount,
      totalCount,
      page: query.page,
      limit: query.limit,
    };
  }

  async getUnreadCount(userId: number): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.notification.count({
      where: { ...this.userScopeFilter(userId), isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(
    userId: number,
    notificationId: number,
  ): Promise<NotificationResponseDto> {
    const notification = await this.findOwnedNotificationOrThrow(
      userId,
      notificationId,
    );

    if (notification.isRead) {
      return this.toResponseDto(notification);
    }

    await this.prisma.notification.updateMany({
      where: {
        ...this.userScopeFilter(userId),
        id: notificationId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    const updatedNotification = await this.findOwnedNotificationOrThrow(
      userId,
      notificationId,
    );
    return this.toResponseDto(updatedNotification);
  }

  async markAllAsRead(userId: number): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.userScopeFilter(userId), isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  private userScopeFilter(userId: number): Prisma.NotificationWhereInput {
    return { userId };
  }

  private async findOwnedNotificationOrThrow(
    userId: number,
    notificationId: number,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        ...this.userScopeFilter(userId),
        id: notificationId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private toResponseDto(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      appointmentId: notification.appointmentId,
      queueEntryId: notification.queueEntryId,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}

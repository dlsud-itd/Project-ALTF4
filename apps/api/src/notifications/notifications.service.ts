import {
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AccessRole, Notification, Prisma } from '@prisma/client';
import { Observable, Subject, filter, map } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannelService } from './channels/email-channel.service';
import { SmsChannelService } from './channels/sms-channel.service';
import {
  buildNotificationPayload,
  NOTIFICATION_EVENT_RULES,
  NotificationEvent,
  NotificationPayload,
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

interface NotificationRecipientRecord {
  id: number;
  email?: string;
  fullName?: string;
  phoneNumber?: string | null;
  role?: AccessRole;
}

interface UserNotificationStreamItem {
  userId: number;
  payload: NotificationPayload;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly userNotificationEvents$ =
    new Subject<UserNotificationStreamItem>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailChannel?: EmailChannelService,
    @Optional() private readonly smsChannel?: SmsChannelService,
  ) {}

  getUserNotificationStream(userId: number): Observable<MessageEvent> {
    return this.userNotificationEvents$.pipe(
      filter((item) => item.userId === userId),
      map((item) => ({
        type: 'notification:created',
        data: {
          type: item.payload.type,
          title: item.payload.title,
          message: item.payload.message,
          appointmentId: item.payload.appointmentId ?? null,
          queueEntryId: item.payload.queueEntryId ?? null,
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }

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

    const recipients = (await this.prisma.user.findMany({
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
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
      },
    })) as NotificationRecipientRecord[];

    if (recipients.length === 0) {
      return 0;
    }

    const payload = buildNotificationPayload(event);
    const result = await this.prisma.notification.createMany({
      data: recipients.map(({ id }) => ({ ...payload, userId: id })),
    });

    for (const recipient of recipients) {
      this.userNotificationEvents$.next({
        userId: recipient.id,
        payload,
      });
    }

    void this.dispatchExternalChannels(recipients, payload).catch((error) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`External notification dispatch error: ${reason}`);
    });

    return result.count;
  }

  async notifyWalkInSms(
    phoneNumber: string | null | undefined,
    event: NotificationEvent,
  ): Promise<void> {
    if (!phoneNumber || !this.smsChannel?.isEnabled()) {
      return;
    }
    const payload = buildNotificationPayload(event);
    await this.smsChannel.send({
      to: phoneNumber,
      type: payload.type,
      title: payload.title,
      message: payload.message,
    });
  }

  private async dispatchExternalChannels(
    recipients: readonly NotificationRecipientRecord[],
    payload: NotificationPayload,
  ): Promise<void> {
    const tasks: Promise<unknown>[] = [];

    for (const recipient of recipients) {
      if (recipient.email && this.emailChannel?.isEnabled()) {
        tasks.push(
          this.emailChannel.send({
            to: recipient.email,
            recipientName: recipient.fullName || 'ClinicQueue User',
            type: payload.type,
            title: payload.title,
            message: payload.message,
          }),
        );
      }

      // Send SMS only to patient recipients to conserve the 6 SMS/min gateway limit.
      if (
        recipient.phoneNumber &&
        recipient.role === AccessRole.PATIENT &&
        this.smsChannel?.isEnabled()
      ) {
        tasks.push(
          this.smsChannel.send({
            to: recipient.phoneNumber,
            type: payload.type,
            title: payload.title,
            message: payload.message,
          }),
        );
      }
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
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

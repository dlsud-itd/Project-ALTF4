import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  id!: number;
  type!: NotificationType;
  title!: string;
  message!: string;
  appointmentId!: number | null;
  queueEntryId!: number | null;
  isRead!: boolean;
  readAt!: Date | null;
  createdAt!: Date;
}

export class NotificationsListResponseDto {
  notifications!: NotificationResponseDto[];
  unreadCount!: number;
  totalCount!: number;
  page!: number;
  limit!: number;
}

export class UnreadCountResponseDto {
  unreadCount!: number;
}

export class MarkAllNotificationsReadResponseDto {
  updatedCount!: number;
}

import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  MarkAllNotificationsReadResponseDto,
  NotificationResponseDto,
  NotificationsListResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's notifications" })
  @ApiResponse({ status: 200, type: NotificationsListResponseDto })
  async list(
    @Request() request: { user: AuthenticatedUser },
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationsListResponseDto> {
    return this.notificationsService.listForUser(request.user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: "Get the authenticated user's unread count" })
  @ApiResponse({ status: 200, type: UnreadCountResponseDto })
  async getUnreadCount(
    @Request() request: { user: AuthenticatedUser },
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(request.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: "Mark the authenticated user's notifications read" })
  @ApiResponse({ status: 200, type: MarkAllNotificationsReadResponseDto })
  async markAllAsRead(
    @Request() request: { user: AuthenticatedUser },
  ): Promise<MarkAllNotificationsReadResponseDto> {
    return this.notificationsService.markAllAsRead(request.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark an owned notification as read' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Request() request: { user: AuthenticatedUser },
    @Param('id', ParseIntPipe) notificationId: number,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(
      request.user.id,
      notificationId,
    );
  }
}

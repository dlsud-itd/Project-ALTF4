import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Request,
  ParseIntPipe,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccessRole } from '@prisma/client';
import { QueueService } from './queue.service';
import { WalkInDto } from './dto/walk-in.dto';
import { CallNextDto } from './dto/call-next.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';

// Controller exposing HTTP and Server-Sent Events endpoints for clinic queue management.
@ApiTags('Queue Management')
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  // Streams real-time queue notifications and call events to clients via Server-Sent Events.
  @Sse(':queueId/events')
  @ApiOperation({
    summary: 'Stream real-time queue events via Server-Sent Events',
  })
  @ApiResponse({
    status: 200,
    description: 'Stream of queue events (queue:updated, queue:called)',
  })
  streamEvents(
    @Param('queueId', ParseIntPipe) queueId: number,
  ): Observable<MessageEvent> {
    return this.queueService.getQueueEvents(queueId);
  }

  // Registers an online queue entry for an existing user or registered patient.
  @Post(':queueId/online')
  @ApiOperation({ summary: 'Join online queue' })
  @ApiResponse({ status: 201, description: 'Online queue entry created' })
  async joinOnline(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: WalkInDto,
  ) {
    return this.queueService.joinOnline(queueId, dto);
  }

  // Registers a walk-in patient, issues a sequential ticket, and enqueues the entry.
  @Post(':queueId/walk-in')
  @ApiOperation({ summary: 'Join walk-in queue session' })
  @ApiResponse({
    status: 201,
    description: 'Queue entry created and sequential ticket assigned',
  })
  @ApiResponse({ status: 400, description: 'Queue closed or invalid data' })
  @ApiResponse({ status: 404, description: 'Queue session not found' })
  async joinWalkIn(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: WalkInDto,
  ) {
    return this.queueService.joinWalkIn(queueId, dto);
  }

  @Post(':queueId/staff-generated')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Create a staff-generated queue number for a patient present on-site',
  })
  async joinStaffGenerated(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: WalkInDto,
  ) {
    return this.queueService.joinStaffGenerated(queueId, dto);
  }

  @Get('track/:trackingToken')
  @ApiOperation({ summary: 'Look up queue status by tracking token' })
  async getTrackingStatus(@Param('trackingToken') trackingToken: string) {
    return this.queueService.getTrackingStatus(trackingToken);
  }

  @Get(':queueId/track/:trackingToken')
  @ApiOperation({ summary: 'Look up queue status by queue and tracking token' })
  async getTrackingStatusForQueue(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('trackingToken') trackingToken: string,
  ) {
    return this.queueService.getTrackingStatus(trackingToken);
  }

  @Get(':queueId/my-entry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.PATIENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get active queue entry for the authenticated patient',
  })
  @ApiResponse({
    status: 200,
    description: 'Active queue entry retrieved or null if not in queue',
  })
  @ApiResponse({ status: 404, description: 'Queue session not found' })
  async getMyQueueEntry(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.queueService.getMyQueueEntry(queueId, req.user.id);
  }

  // Retrieves real-time summary statistics, current serving ticket, and waiting counts.
  @Get(':queueId/status')
  @ApiOperation({ summary: 'Get current operational status of the queue' })
  @ApiResponse({ status: 200, description: 'Queue real-time status retrieved' })
  @ApiResponse({ status: 404, description: 'Queue session not found' })
  async getStatus(@Param('queueId', ParseIntPipe) queueId: number) {
    return this.queueService.getQueueStatus(queueId);
  }

  // Advances the queue and assigns the next waiting patient to a designated counter.
  @Post(':queueId/call-next')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Advance queue and call next patient (Staff/Admin)',
  })
  @ApiResponse({ status: 200, description: 'Next patient called successfully' })
  @ApiResponse({ status: 400, description: 'No waiting patients in queue' })
  async callNext(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: CallNextDto,
  ) {
    return this.queueService.callNext(queueId, dto);
  }

  // Updates the lifecycle status or notes of a specific patient queue entry.
  @Patch(':queueId/entries/:entryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccessRole.STAFF, AccessRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update status of specific queue entry (Staff/Admin)',
  })
  @ApiResponse({ status: 200, description: 'Queue entry updated successfully' })
  async updateEntryStatus(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: UpdateEntryStatusDto,
  ) {
    return this.queueService.updateEntryStatus(queueId, entryId, dto);
  }
}

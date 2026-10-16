import { Controller, Post, Get, Patch, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { WalkInDto } from './dto/walk-in.dto';
import { CallNextDto } from './dto/call-next.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Queue Management')
@Controller('queues')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post(':queueId/walk-in')
  @ApiOperation({ summary: 'Join walk-in queue session' })
  @ApiResponse({ status: 201, description: 'Queue entry created and sequential ticket assigned' })
  @ApiResponse({ status: 400, description: 'Queue closed or invalid data' })
  @ApiResponse({ status: 404, description: 'Queue session not found' })
  async joinWalkIn(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: WalkInDto,
  ) {
    return this.queueService.joinWalkIn(queueId, dto);
  }

  @Get(':queueId/status')
  @ApiOperation({ summary: 'Get current operational status of the queue' })
  @ApiResponse({ status: 200, description: 'Queue real-time status retrieved' })
  @ApiResponse({ status: 404, description: 'Queue session not found' })
  async getStatus(@Param('queueId', ParseIntPipe) queueId: number) {
    return this.queueService.getQueueStatus(queueId);
  }

  @Post(':queueId/call-next')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Advance queue and call next patient (Staff/Admin)' })
  @ApiResponse({ status: 200, description: 'Next patient called successfully' })
  @ApiResponse({ status: 400, description: 'No waiting patients in queue' })
  async callNext(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() dto: CallNextDto,
  ) {
    return this.queueService.callNext(queueId, dto);
  }

  @Patch(':queueId/entries/:entryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update status of specific queue entry (Staff/Admin)' })
  @ApiResponse({ status: 200, description: 'Queue entry updated successfully' })
  async updateEntryStatus(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: UpdateEntryStatusDto,
  ) {
    return this.queueService.updateEntryStatus(queueId, entryId, dto);
  }
}

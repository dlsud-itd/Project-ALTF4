import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueController } from './queue.controller';
import { QueueEventsService } from './queue-events.service';
import { QueueReadService } from './queue-read.service';
import { QueueService } from './queue.service';

@Module({
  imports: [AuthModule],
  controllers: [QueueController],
  providers: [QueueEventsService, QueueReadService, QueueService],
  exports: [QueueService],
})
export class QueueModule {}

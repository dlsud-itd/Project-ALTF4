import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueController } from './queue.controller';
import { QueueEventsService } from './queue-events.service';
import { QueueLifecycleService } from './queue-lifecycle.service';
import { QueueReadService } from './queue-read.service';
import { QueueService } from './queue.service';

@Module({
  imports: [AuthModule],
  controllers: [QueueController],
  providers: [
    QueueEventsService,
    QueueLifecycleService,
    QueueReadService,
    QueueService,
  ],
  exports: [QueueEventsService, QueueLifecycleService, QueueService],
})
export class QueueModule {}

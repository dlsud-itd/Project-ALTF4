import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { SlotGenerationService } from './slot-generation.service';
import { SlotBlockingService } from './slot-blocking.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [SlotsController],
  providers: [SlotsService, SlotGenerationService, SlotBlockingService],
  exports: [SlotsService],
})
export class SlotsModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { SlotGenerationService } from './slot-generation.service';

@Module({
  imports: [AuthModule],
  controllers: [SlotsController],
  providers: [SlotsService, SlotGenerationService],
  exports: [SlotsService],
})
export class SlotsModule {}

import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailChannelService } from './channels/email-channel.service';
import { SmsChannelService } from './channels/sms-channel.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailChannelService, SmsChannelService],
  exports: [NotificationsService, EmailChannelService, SmsChannelService],
})
export class NotificationsModule {}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import {
  isValidPhMobile,
  maskPhoneNumber,
  normalizePhMobile,
} from '../../common/phone-number.util';

export interface SmsNotificationInput {
  to: string | null | undefined;
  type: NotificationType;
  title: string;
  message: string;
}

const DEFAULT_SMS_API_URL = 'https://smsapiph.onrender.com/api/v1/send/sms';
const SMS_MAX_CHARS = 160;
const SMS_TIMEOUT_MS = 5000;

@Injectable()
export class SmsChannelService {
  private readonly logger = new Logger(SmsChannelService.name);
  private readonly enabled: boolean;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const rawEnabled = this.configService.get<string>('SMS_ENABLED');
    const apiUrl =
      this.configService.get<string>('SMS_API_URL')?.trim() ||
      DEFAULT_SMS_API_URL;
    const apiKey = this.configService.get<string>('SMS_API_KEY')?.trim() ?? '';

    this.apiUrl = apiUrl;
    this.apiKey = apiKey;

    const explicitlyDisabled = rawEnabled?.toLowerCase() === 'false';
    const explicitlyEnabled = rawEnabled?.toLowerCase() === 'true';

    if (explicitlyDisabled || (!explicitlyEnabled && !apiKey)) {
      this.enabled = false;
      this.logger.log(
        'SMS notifications disabled (set SMS_ENABLED=true and SMS_API_KEY to enable).',
      );
      return;
    }

    if (!apiKey) {
      this.enabled = false;
      this.logger.warn(
        'SMS notifications disabled — SMS_ENABLED=true but SMS_API_KEY is missing.',
      );
      return;
    }

    this.enabled = true;
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.apiKey);
  }

  async send(input: SmsNotificationInput): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    if (!isValidPhMobile(input.to)) {
      this.logger.debug(
        `Skipping SMS (${input.type}): invalid or placeholder recipient phone number.`,
      );
      return false;
    }

    const recipient = normalizePhMobile(input.to) as string;
    const formattedMessage = this.formatSmsMessage(input.title, input.message);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient,
          message: formattedMessage,
        }),
        signal: AbortSignal.timeout(SMS_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.warn(
          `SMS API PH returned HTTP ${response.status} for ${input.type} (${maskPhoneNumber(recipient)}): ${errorText.slice(0, 200)}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `SMS delivery failed (${input.type}) for ${maskPhoneNumber(recipient)}: ${reason}`,
      );
      return false;
    }
  }

  private formatSmsMessage(title: string, message: string): string {
    const raw = `ClinicQueue: ${title} - ${message}`
      .replace(/\s+/g, ' ')
      .trim();
    if (raw.length <= SMS_MAX_CHARS) {
      return raw;
    }
    return `${raw.slice(0, SMS_MAX_CHARS - 3)}...`;
  }
}

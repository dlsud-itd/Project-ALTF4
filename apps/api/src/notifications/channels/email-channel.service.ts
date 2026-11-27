import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailNotificationInput {
  to: string;
  recipientName: string;
  type: NotificationType;
  title: string;
  message: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailChannelService {
  private readonly logger = new Logger(EmailChannelService.name);
  private readonly enabled: boolean;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly transporter: Transporter | null;

  constructor(private readonly configService: ConfigService) {
    const rawEnabled = this.configService.get<string>('SMTP_ENABLED');
    const host = this.configService.get<string>('SMTP_HOST')?.trim() ?? '';
    const portRaw =
      this.configService.get<string>('SMTP_PORT')?.trim() ?? '587';
    const user = this.configService.get<string>('SMTP_USER')?.trim() ?? '';
    const pass = this.configService.get<string>('SMTP_PASS')?.trim() ?? '';
    const fromEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL')?.trim() || user;
    const fromName =
      this.configService.get<string>('SMTP_FROM_NAME')?.trim() ||
      'DLSU-D ClinicQueue';

    this.fromAddress = fromEmail;
    this.fromName = fromName;

    const explicitlyDisabled = rawEnabled?.toLowerCase() === 'false';
    const hasCredentials = Boolean(host && user && pass && fromEmail);

    if (explicitlyDisabled) {
      this.enabled = false;
      this.transporter = null;
      this.logger.log('Email notifications disabled (SMTP_ENABLED=false).');
      return;
    }

    if (!hasCredentials) {
      this.enabled = false;
      this.transporter = null;
      this.logger.warn(
        'Email notifications disabled — missing SMTP_HOST, SMTP_USER, SMTP_PASS, or SMTP_FROM_EMAIL.',
      );
      return;
    }

    const port = Number.parseInt(portRaw, 10);
    const resolvedPort = Number.isFinite(port) && port > 0 ? port : 587;

    this.enabled = true;
    this.transporter = nodemailer.createTransport({
      host,
      port: resolvedPort,
      secure: resolvedPort === 465,
      pool: true,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      auth: {
        user,
        pass,
      },
    });
  }

  isEnabled(): boolean {
    return this.enabled && this.transporter !== null;
  }

  async send(input: EmailNotificationInput): Promise<boolean> {
    if (!this.isEnabled() || !this.transporter) {
      return false;
    }

    const recipient = input.to.trim();
    if (!recipient) {
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromAddress}>`,
        to: recipient,
        subject: `[ClinicQueue] ${input.title}`,
        text: this.buildTextBody(input),
        html: this.buildHtmlBody(input),
      });
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to send email (${input.type}) to ${recipient}: ${reason}`,
      );
      return false;
    }
  }

  private buildTextBody(input: EmailNotificationInput): string {
    return [
      `Hello ${input.recipientName},`,
      '',
      input.title,
      input.message,
      '',
      '— DLSU-D ClinicQueue',
    ].join('\n');
  }

  private buildHtmlBody(input: EmailNotificationInput): string {
    const safeName = escapeHtml(input.recipientName);
    const safeTitle = escapeHtml(input.title);
    const safeMessage = escapeHtml(input.message);

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="margin: 0 0 12px; color: #0f766e; font-size: 18px;">${safeTitle}</h2>
        <p style="margin: 0 0 12px;">Hello ${safeName},</p>
        <p style="margin: 0 0 20px; font-size: 15px;">${safeMessage}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="margin: 0; font-size: 12px; color: #6b7280;">DLSU-D ClinicQueue Automated Notification</p>
      </div>
    `.trim();
  }
}

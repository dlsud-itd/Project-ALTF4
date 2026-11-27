import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { EmailChannelService } from './email-channel.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('EmailChannelService', () => {
  const sendMailMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });
  });

  function makeConfig(
    values: Record<string, string | undefined>,
  ): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it('disables itself safely when SMTP credentials are missing', async () => {
    const service = new EmailChannelService(makeConfig({}));

    expect(service.isEnabled()).toBe(false);
    await expect(
      service.send({
        to: 'patient@dlsud.edu.ph',
        recipientName: 'Juan Dela Cruz',
        type: NotificationType.BOOKING_CONFIRMATION,
        title: 'Booking confirmed',
        message: 'Your appointment is confirmed.',
      }),
    ).resolves.toBe(false);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('sends escaped HTML and text email via Brevo SMTP when configured', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'msg-1' });
    const service = new EmailChannelService(
      makeConfig({
        SMTP_ENABLED: 'true',
        SMTP_HOST: 'smtp-relay.brevo.com',
        SMTP_PORT: '587',
        SMTP_USER: 'login@example.com',
        SMTP_PASS: 'smtp-secret-key',
        SMTP_FROM_EMAIL: 'clinic@dlsud.edu.ph',
        SMTP_FROM_NAME: 'ClinicQueue',
      }),
    );

    expect(service.isEnabled()).toBe(true);
    const ok = await service.send({
      to: 'patient@dlsud.edu.ph',
      recipientName: 'Juan <Test>',
      type: NotificationType.BOOKING_CONFIRMATION,
      title: 'Booking confirmed',
      message: 'Confirmed for 2026-11-28 at 09:00.',
    });

    expect(ok).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: 'login@example.com', pass: 'smtp-secret-key' },
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"ClinicQueue" <clinic@dlsud.edu.ph>',
        to: 'patient@dlsud.edu.ph',
        subject: '[ClinicQueue] Booking confirmed',
      }),
    );
    const firstCall = sendMailMock.mock.calls[0] as unknown[];
    const mailArgs = firstCall[0] as { html: string };
    expect(mailArgs.html).toContain('Juan &lt;Test&gt;');
  });

  it('catches SMTP delivery errors and returns false without throwing', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP connection timeout'));
    const service = new EmailChannelService(
      makeConfig({
        SMTP_HOST: 'smtp-relay.brevo.com',
        SMTP_PORT: '587',
        SMTP_USER: 'login@example.com',
        SMTP_PASS: 'smtp-secret-key',
      }),
    );

    await expect(
      service.send({
        to: 'patient@dlsud.edu.ph',
        recipientName: 'Juan',
        type: NotificationType.QUEUE_CALL,
        title: 'Your turn is here',
        message: 'Ticket A-001 called.',
      }),
    ).resolves.toBe(false);
  });
});

import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { SmsChannelService } from './sms-channel.service';

describe('SmsChannelService', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  function makeConfig(
    values: Record<string, string | undefined>,
  ): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it('disables itself safely when SMS_API_KEY is missing', async () => {
    const service = new SmsChannelService(makeConfig({}));

    expect(service.isEnabled()).toBe(false);
    await expect(
      service.send({
        to: '+639171234567',
        type: NotificationType.QUEUE_CALL,
        title: 'Your turn is here',
        message: 'Ticket A-001 is called.',
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes PH mobile number, clamps to 160 chars, and sends with x-api-key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{}'),
    });

    const service = new SmsChannelService(
      makeConfig({
        SMS_ENABLED: 'true',
        SMS_API_KEY: 'sk-test-key',
      }),
    );

    const longMessage = 'A'.repeat(220);
    const ok = await service.send({
      to: '0917 123 4567',
      type: NotificationType.QUEUE_CALL,
      title: 'Your turn is here',
      message: longMessage,
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://smsapiph.onrender.com/api/v1/send/sms',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'x-api-key': 'sk-test-key',
          'Content-Type': 'application/json',
        },
      }),
    );

    const firstCall = fetchMock.mock.calls[0] as unknown[];
    const requestInit = firstCall[1] as { body: string };
    const parsedBody = JSON.parse(requestInit.body) as {
      recipient: string;
      message: string;
    };
    expect(parsedBody.recipient).toBe('+639171234567');
    expect(parsedBody.message.length).toBeLessThanOrEqual(160);
    expect(parsedBody.message.endsWith('...')).toBe(true);
  });

  it('skips invalid or placeholder numbers without calling the API', async () => {
    const service = new SmsChannelService(
      makeConfig({
        SMS_ENABLED: 'true',
        SMS_API_KEY: 'sk-test-key',
      }),
    );

    await expect(
      service.send({
        to: '+639000000000',
        type: NotificationType.QUEUE_CALL,
        title: 'Your turn is here',
        message: 'Ticket A-001 called.',
      }),
    ).resolves.toBe(false);
    await expect(
      service.send({
        to: '12345',
        type: NotificationType.QUEUE_CALL,
        title: 'Your turn is here',
        message: 'Ticket A-001 called.',
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false gracefully when SMS API PH returns an HTTP error or rejects', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValue('Rate limit exceeded'),
    });

    const service = new SmsChannelService(
      makeConfig({
        SMS_ENABLED: 'true',
        SMS_API_KEY: 'sk-test-key',
      }),
    );

    await expect(
      service.send({
        to: '+639171234567',
        type: NotificationType.QUEUE_CALL,
        title: 'Your turn is here',
        message: 'Ticket A-001 called.',
      }),
    ).resolves.toBe(false);

    fetchMock.mockRejectedValue(new Error('Network timeout'));
    await expect(
      service.send({
        to: '+639171234567',
        type: NotificationType.QUEUE_CALL,
        title: 'Your turn is here',
        message: 'Ticket A-001 called.',
      }),
    ).resolves.toBe(false);
  });
});

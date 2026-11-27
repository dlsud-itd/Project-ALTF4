import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WalkInDto } from './walk-in.dto';

describe('WalkInDto', () => {
  it('requires and normalizes phone number and visit reason', async () => {
    const dto = plainToInstance(WalkInDto, {
      name: "  Jane   O'Neil  ",
      phoneNumber: ' 0917-123-4567 ',
      reasonForVisit: '  General checkup  ',
    });

    expect(dto.name).toBe("Jane O'Neil");
    expect(dto.phoneNumber).toBe('+639171234567');
    expect(dto.reasonForVisit).toBe('General checkup');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a missing name, invalid characters, and names over 60 characters', async () => {
    const missingName = plainToInstance(WalkInDto, {});
    const invalidName = plainToInstance(WalkInDto, {
      name: 'Jane 42',
      phoneNumber: '+639171234567',
      reasonForVisit: 'Fever',
    });
    const longName = plainToInstance(WalkInDto, {
      name: 'J'.repeat(61),
      phoneNumber: '+639171234567',
      reasonForVisit: 'Fever',
    });

    expect(await validate(missingName)).not.toHaveLength(0);
    expect(await validate(invalidName)).not.toHaveLength(0);
    expect(await validate(longName)).not.toHaveLength(0);
  });

  it('rejects a missing or invalid Philippine mobile number', async () => {
    const missingPhone = plainToInstance(WalkInDto, {
      name: 'Jane Doe',
      reasonForVisit: 'Fever',
    });
    const invalidPhone = plainToInstance(WalkInDto, {
      name: 'Jane Doe',
      phoneNumber: '12345',
      reasonForVisit: 'Fever',
    });

    expect(await validate(missingPhone)).not.toHaveLength(0);
    expect(await validate(invalidPhone)).not.toHaveLength(0);
  });

  it('rejects a missing, blank, or overlong visit reason', async () => {
    const missingReason = plainToInstance(WalkInDto, {
      name: 'Jane Doe',
      phoneNumber: '+639171234567',
    });
    const blankReason = plainToInstance(WalkInDto, {
      name: 'Jane Doe',
      phoneNumber: '+639171234567',
      reasonForVisit: '   ',
    });
    const dto = plainToInstance(WalkInDto, {
      name: 'Jane Doe',
      phoneNumber: '+639171234567',
      reasonForVisit: 'R'.repeat(201),
    });

    expect(await validate(missingReason)).not.toHaveLength(0);
    expect(await validate(blankReason)).not.toHaveLength(0);
    expect(await validate(dto)).not.toHaveLength(0);
  });
});

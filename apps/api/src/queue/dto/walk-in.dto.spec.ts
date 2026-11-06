import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WalkInDto } from './walk-in.dto';

describe('WalkInDto', () => {
  it('requires only a normalized name and accepts an optional visit reason', async () => {
    const dto = plainToInstance(WalkInDto, {
      name: "  Jane   O'Neil  ",
      reasonForVisit: '  General checkup  ',
    });

    expect(dto.name).toBe("Jane O'Neil");
    expect(dto.reasonForVisit).toBe('General checkup');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a missing name, invalid characters, and names over 60 characters', async () => {
    const missingName = plainToInstance(WalkInDto, {});
    const invalidName = plainToInstance(WalkInDto, { name: 'Jane 42' });
    const longName = plainToInstance(WalkInDto, { name: 'J'.repeat(61) });

    expect(await validate(missingName)).not.toHaveLength(0);
    expect(await validate(invalidName)).not.toHaveLength(0);
    expect(await validate(longName)).not.toHaveLength(0);
  });

  it('limits the optional visit reason to 200 characters', async () => {
    const dto = plainToInstance(WalkInDto, {
      name: 'Jane Doe',
      reasonForVisit: 'R'.repeat(201),
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});

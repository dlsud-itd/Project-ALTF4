import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CallNextDto } from './call-next.dto';

describe('CallNextDto', () => {
  it('trims room and provider values before validation', async () => {
    const dto = plainToInstance(CallNextDto, {
      room: ' Room 4 ',
      provider: ' Dr. Ana Santos ',
    });

    expect(dto.room).toBe('Room 4');
    expect(dto.provider).toBe('Dr. Ana Santos');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects blank and overlong fields by field name', async () => {
    const dto = plainToInstance(CallNextDto, {
      room: '   ',
      provider: 'P'.repeat(61),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(['room', 'provider']);
  });
});

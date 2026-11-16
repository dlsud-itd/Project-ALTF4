import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEntryStatusDto } from './update-entry-status.dto';

describe('UpdateEntryStatusDto', () => {
  it('rejects invalid statuses and notes longer than 500 characters', async () => {
    const dto = plainToInstance(UpdateEntryStatusDto, {
      status: 'UNKNOWN',
      notes: 'N'.repeat(501),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(['status', 'notes']);
  });
});

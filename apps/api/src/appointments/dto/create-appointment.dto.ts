import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({
    example: 1,
    description: 'Unique ID of the clinic slot to book',
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  slotId!: number;

  @ApiProperty({
    example: 'Routine checkup and consultation',
    description: 'Required reason for the consultation visit',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reasonForVisit!: string;
}

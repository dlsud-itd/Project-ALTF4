import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSlotDto {
  @ApiProperty({
    example: '2026-11-12',
    description: 'Date of the clinic slot (YYYY-MM-DD)',
  })
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsNotEmpty()
  clinicDate!: string;

  @ApiProperty({ example: '10:15', description: 'Slot start time (HH:mm)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ example: '10:45', description: 'Slot end time (HH:mm)' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsNotEmpty()
  endTime!: string;

  @ApiProperty({ example: 2, description: 'Slot capacity', minimum: 1 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the slot is open for bookings',
    default: true,
  })
  @IsBoolean()
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  isBookable?: boolean;
}

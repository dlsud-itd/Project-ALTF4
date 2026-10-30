import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSlotDto {
  @ApiPropertyOptional({
    example: '2026-11-12',
    description: 'Updated date of the clinic slot',
  })
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  clinicDate?: string;

  @ApiPropertyOptional({ example: '10:30', description: 'Updated start time' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  startTime?: string;

  @ApiPropertyOptional({ example: '11:00', description: 'Updated end time' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  endTime?: string;

  @ApiPropertyOptional({ example: 3, description: 'Updated capacity' })
  @IsInt()
  @Min(1)
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  capacity?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Updated bookable status',
  })
  @IsBoolean()
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  isBookable?: boolean;
}

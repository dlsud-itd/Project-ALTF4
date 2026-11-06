import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PATIENT_NAME_REGEX = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;

export class WalkInDto {
  @ApiPropertyOptional({
    example: 12,
    description: 'Existing patient account ID if already registered',
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  patientId?: number;

  @ApiProperty({ example: "Jane O'Neil", description: 'Patient name' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  @Matches(PATIENT_NAME_REGEX, {
    message: 'name may contain only letters, spaces, hyphens, and apostrophes',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'Fever and headache',
    description: 'Reason for consultation',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) {
      return value;
    }
    return typeof value === 'string' ? value.trim() || undefined : value;
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reasonForVisit?: string;
}

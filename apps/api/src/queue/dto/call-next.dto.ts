import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CallNextDto {
  @ApiProperty({
    example: 'Exam Room 2B',
    description: 'Trimmed room or counter designation (up to 60 characters)',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  room!: string;

  @ApiProperty({
    example: 'Dr. Ana Santos',
    description: 'Trimmed practitioner name (up to 60 characters)',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  provider!: string;
}

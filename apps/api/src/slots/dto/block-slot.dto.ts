import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockDayDto {
  @ApiProperty({
    example: '2026-11-24',
    description: 'Clinic date to block or unblock (YYYY-MM-DD)',
  })
  @IsString()
  clinicDate!: string;

  @ApiProperty({
    example: true,
    description: 'True to block every slot that day, false to reopen them',
  })
  @IsBoolean()
  isBlocked!: boolean;

  @ApiPropertyOptional({
    example: 'Doctor on leave',
    description: 'Optional reason recorded on the audit trail',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class BlockSlotDto {
  @ApiProperty({
    example: true,
    description: 'True to block this slot, false to reopen it',
  })
  @IsBoolean()
  isBlocked!: boolean;

  @ApiPropertyOptional({
    example: 'Nurse unavailable',
    description: 'Optional reason recorded on the audit trail',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

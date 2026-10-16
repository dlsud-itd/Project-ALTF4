import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSlotDto {
  @ApiPropertyOptional({ example: '2026-11-12', description: 'Updated date of the clinic slot' })
  @IsDateString()
  @IsOptional()
  clinicDate?: string;

  @ApiPropertyOptional({ example: '10:30', description: 'Updated start time' })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ example: '11:00', description: 'Updated end time' })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ example: 3, description: 'Updated capacity' })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: true, description: 'Updated bookable status' })
  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;
}

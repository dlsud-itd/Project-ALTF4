import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueueStatus } from '@prisma/client';

export class UpdateEntryStatusDto {
  @ApiProperty({ enum: QueueStatus, example: QueueStatus.SERVED, description: 'New lifecycle status for queue entry' })
  @IsEnum(QueueStatus)
  @IsNotEmpty()
  status!: QueueStatus;

  @ApiPropertyOptional({ example: 'Consultation finished, follow-up scheduled in 2 weeks.', description: 'Administrative notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

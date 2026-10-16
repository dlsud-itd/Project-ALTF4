import { IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueuePriority } from '@prisma/client';

export class WalkInDto {
  @ApiProperty({ example: 'Jane', description: 'Patient first name' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'Patient last name' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '+639171234567', description: 'Contact phone number' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiPropertyOptional({ example: 'Fever and Headache', description: 'Reason for consultation' })
  @IsString()
  @IsOptional()
  reasonForVisit?: string;

  @ApiPropertyOptional({ enum: QueuePriority, example: QueuePriority.NORMAL, default: QueuePriority.NORMAL })
  @IsEnum(QueuePriority)
  @IsOptional()
  priority?: QueuePriority;
}

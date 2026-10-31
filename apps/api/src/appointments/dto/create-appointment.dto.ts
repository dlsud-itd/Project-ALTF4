import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({
    example: 1,
    description: 'Unique ID of the clinic slot to book',
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  slotId!: number;

  @ApiPropertyOptional({
    example: 'Routine checkup and consultation',
    description: 'Reason for the consultation visit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reasonForVisit?: string;
}


import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RescheduleAppointmentDto {
  @ApiProperty({
    example: 2,
    description: 'Unique ID of the clinic slot to move the appointment to',
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  slotId!: number;
}

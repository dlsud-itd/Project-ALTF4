import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CallNextDto {
  @ApiProperty({ example: 'Exam Room 2B', description: 'Consultation room or counter designation' })
  @IsString()
  @IsNotEmpty()
  roomNumber!: string;

  @ApiProperty({ example: '1', description: 'Identifier of the attending practitioner or staff' })
  @IsString()
  @IsNotEmpty()
  practitionerId!: string;
}

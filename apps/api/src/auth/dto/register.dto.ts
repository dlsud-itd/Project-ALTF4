import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClinicAffiliation } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'John Albert Masangkay', description: "User's full name" })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'johnalbert@gmail.com', description: "User's email address" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!', description: "User's password", minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ enum: ClinicAffiliation, example: ClinicAffiliation.STUDENT, description: 'Affiliation with the institution' })
  @IsEnum(ClinicAffiliation)
  affiliation!: ClinicAffiliation;
}

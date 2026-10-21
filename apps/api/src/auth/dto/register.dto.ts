import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClinicAffiliation } from '@prisma/client';
import { normalizeString } from './normalize-string';

export class RegisterDto {
  @ApiProperty({
    example: 'John Albert Masangkay',
    description: "User's full name",
  })
  @Transform(({ value }) => normalizeString(value, (input) => input.trim()))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName!: string;

  @ApiProperty({
    example: 'johnalbert@gmail.com',
    description: "User's email address",
  })
  @Transform(({ value }) =>
    normalizeString(value, (input) => input.trim().toLowerCase()),
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: "User's password",
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  @Matches(/\S/, {
    message: 'password must contain a non-whitespace character',
  })
  password!: string;

  @ApiProperty({
    enum: ClinicAffiliation,
    example: ClinicAffiliation.STUDENT,
    description: 'Affiliation with the institution',
  })
  @Transform(({ value }) =>
    normalizeString(value, (input) => input.trim().toUpperCase()),
  )
  @IsEnum(ClinicAffiliation)
  affiliation!: ClinicAffiliation;
}

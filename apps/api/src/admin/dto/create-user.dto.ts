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
import { AccessRole, ClinicAffiliation } from '@prisma/client';
import {
  normalizePhMobile,
  PH_MOBILE_E164_REGEX,
} from '../../common/phone-number.util';

export class AdminCreateUserDto {
  @ApiProperty({
    example: 'Dr. Jane Santos',
    description: "User's full name",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName!: string;

  @ApiProperty({
    example: 'janesantos@dlsud.edu.ph',
    description: "User's email address",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: '+639171234567',
    description: 'Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)',
  })
  @Transform(({ value }: { value: unknown }) => normalizePhMobile(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(PH_MOBILE_E164_REGEX, {
    message:
      'phoneNumber must be a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)',
  })
  phoneNumber!: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Initial password',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  @Matches(/\S/, {
    message: 'password must contain a non-whitespace character',
  })
  password!: string;

  @ApiProperty({
    enum: AccessRole,
    example: AccessRole.STAFF,
    description: 'User access role',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(AccessRole)
  role!: AccessRole;

  @ApiProperty({
    enum: ClinicAffiliation,
    example: ClinicAffiliation.STAFF,
    description: 'Clinic institutional affiliation',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(ClinicAffiliation)
  affiliation!: ClinicAffiliation;
}

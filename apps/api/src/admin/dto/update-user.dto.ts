import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccessRole, ClinicAffiliation } from '@prisma/client';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({
    example: 'Dr. Jane Santos',
    description: "User's full name",
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'janesantos@dlsud.edu.ph',
    description: "User's email address",
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    example: 'NewSecurePass123!',
    description: 'Updated password',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @Matches(/\S/, {
    message: 'password must contain a non-whitespace character',
  })
  password?: string;

  @ApiPropertyOptional({
    enum: AccessRole,
    example: AccessRole.STAFF,
    description: 'User access role',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(AccessRole)
  role?: AccessRole;

  @ApiPropertyOptional({
    enum: ClinicAffiliation,
    example: ClinicAffiliation.STAFF,
    description: 'Clinic institutional affiliation',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(ClinicAffiliation)
  affiliation?: ClinicAffiliation;

  @ApiPropertyOptional({
    example: true,
    description: 'Active status of account',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

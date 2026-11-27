import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_NON_WHITESPACE_REGEX,
  PASSWORD_RESET_OTP_LENGTH,
  PASSWORD_RESET_OTP_REGEX,
} from '../../common/clinic.constants';
import { normalizeString } from './normalize-string';

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'student@dlsud.edu.ph',
    description: 'Registered email address',
  })
  @Transform(({ value }) =>
    normalizeString(value, (input) => input.trim().toLowerCase()),
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyPasswordResetOtpDto extends RequestPasswordResetDto {
  @ApiProperty({
    example: '123456',
    description: `${PASSWORD_RESET_OTP_LENGTH}-digit numeric OTP sent via email`,
  })
  @Transform(({ value }) => normalizeString(value, (input) => input.trim()))
  @IsString()
  @Matches(PASSWORD_RESET_OTP_REGEX, {
    message: `otp must be a ${PASSWORD_RESET_OTP_LENGTH}-digit numeric code`,
  })
  otp!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Single-use reset proof token returned after OTP verification',
  })
  @Transform(({ value }) => normalizeString(value, (input) => input.trim()))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  resetToken!: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_NON_WHITESPACE_REGEX, {
    message: 'newPassword must contain a non-whitespace character',
  })
  newPassword!: string;

  @ApiProperty({
    example: 'NewSecurePassword123!',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  confirmPassword!: string;
}

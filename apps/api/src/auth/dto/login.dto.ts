import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeString } from './normalize-string';

export class LoginDto {
  @ApiProperty({
    example: 'johnalbert@gmail.com',
    description: 'Registered user email',
  })
  @Transform(({ value }) =>
    normalizeString(value, (input) => input.trim().toLowerCase()),
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

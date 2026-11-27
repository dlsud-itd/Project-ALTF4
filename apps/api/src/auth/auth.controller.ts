import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyPasswordResetOtpDto,
} from './dto/forgot-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser } from './jwt.strategy';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new ClinicQueue user account' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email is already registered' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and return JWT' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out user session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logout(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.authService.logout(
      request.user.tokenId,
      request.user.tokenExpiresAt,
    );
  }

  @Post('forgot-password/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request an email OTP for password reset' })
  @ApiResponse({
    status: 200,
    description:
      'Generic confirmation returned regardless of registration status',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit or resend cooldown active',
  })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Req() request: Request,
  ) {
    const clientIp =
      (request.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      request.ip ||
      'unknown';
    return this.passwordResetService.requestReset(dto.email, clientIp);
  }

  @Post('forgot-password/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify password reset email OTP and issue reset token',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified and reset token issued',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired, or exhausted OTP',
  })
  async verifyPasswordResetOtp(@Body() dto: VerifyPasswordResetOtpDto) {
    return this.passwordResetService.verifyOtp(dto.email, dto.otp);
  }

  @Post('forgot-password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using verified single-use reset token',
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({
    status: 400,
    description: 'Invalid/expired token or password mismatch',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(
      dto.resetToken,
      dto.newPassword,
      dto.confirmPassword,
    );
  }
}

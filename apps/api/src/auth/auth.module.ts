import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ||
          'clinicqueue-dev-secret-key-change-in-production',
        signOptions: {
          expiresIn:
            (config.get<string>(
              'JWT_EXPIRES_IN',
            ) as JwtSignOptions['expiresIn']) || '1d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordResetService, JwtStrategy, RolesGuard],
  exports: [
    AuthService,
    PasswordResetService,
    JwtModule,
    PassportModule,
    RolesGuard,
  ],
})
export class AuthModule {}

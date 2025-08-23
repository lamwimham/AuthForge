import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

// Entities
import { User } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { OAuthProvider } from '../database/entities/oauth-provider.entity';
import { VerificationCode } from '../database/entities/verification-code.entity';
import { MfaDevice } from '../database/entities/mfa-device.entity';

// Services
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { MfaService } from './services/mfa.service';
import { VerificationCodeService } from './services/verification-code.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { OAuthService } from './services/oauth.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { MfaController } from './controllers/mfa.controller';
import { OAuthController } from './controllers/oauth.controller';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';

// Strategies
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';

// Modules
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN', '15m'),
          issuer: 'AuthForge',
          audience: 'AuthForge-users',
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      OAuthProvider,
      VerificationCode,
      MfaDevice,
    ]),
    RedisModule,
  ],
  controllers: [
    AuthController,
    MfaController,
    OAuthController,
  ],
  providers: [
    AuthService,
    UserService,
    TokenService,
    PasswordService,
    MfaService,
    VerificationCodeService,
    EmailService,
    SmsService,
    OAuthService,
    JwtAuthGuard,
    RateLimitGuard,
    GoogleStrategy,
    GitHubStrategy,
  ],
  exports: [
    AuthService,
    UserService,
    TokenService,
    PasswordService,
    MfaService,
    VerificationCodeService,
    EmailService,
    SmsService,
    OAuthService,
    JwtAuthGuard,
    RateLimitGuard,
  ],
})
export class AuthModule {}
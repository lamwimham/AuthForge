import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

// Entities
import { OAuthClient } from '../database/entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../database/entities/oauth-authorization-code.entity';
import { OAuthAccessToken } from '../database/entities/oauth-access-token.entity';
import { SSOSession } from '../database/entities/sso-session.entity';
import { UserConsent } from '../database/entities/user-consent.entity';
import { JwtKey } from '../database/entities/jwt-key.entity';
import { User } from '../database/entities/user.entity';

// Services
import { JwksService } from './services/jwks.service';
import { OAuthService } from './services/oauth.service';
import { ClientManagementService } from './services/client-management.service';

// Controllers
import { OAuthController } from './oauth.controller';
import { ClientManagementController } from './client-management.controller';

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
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      OAuthClient,
      OAuthAuthorizationCode,
      OAuthAccessToken,
      SSOSession,
      UserConsent,
      JwtKey,
      User,
    ]),
    RedisModule,
  ],
  controllers: [OAuthController, ClientManagementController],
  providers: [JwksService, OAuthService, ClientManagementService],
  exports: [JwksService, OAuthService, ClientManagementService],
})
export class OAuthModule {}
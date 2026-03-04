import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OAuthProvider } from './entities/oauth-provider.entity';
import { VerificationCode } from './entities/verification-code.entity';
import { MfaDevice } from './entities/mfa-device.entity';
import { FileMetadata } from './entities/file-metadata.entity';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthAuthorizationCode } from './entities/oauth-authorization-code.entity';
import { OAuthAccessToken } from './entities/oauth-access-token.entity';
import { SSOSession } from './entities/sso-session.entity';
import { UserConsent } from './entities/user-consent.entity';
import { JwtKey } from './entities/jwt-key.entity';

const entities = [
  User,
  RefreshToken,
  OAuthProvider,
  VerificationCode,
  MfaDevice,
  FileMetadata,
  OAuthClient,
  OAuthAuthorizationCode,
  OAuthAccessToken,
  SSOSession,
  UserConsent,
  JwtKey,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: +(configService.get<number>('DATABASE_PORT') || 5432),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities,
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('NODE_ENV') === 'production' ? true : false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OAuthProvider } from './entities/oauth-provider.entity';
import { VerificationCode } from './entities/verification-code.entity';
import { MfaDevice } from './entities/mfa-device.entity';
import { FileMetadata } from './entities/file-metadata.entity';

// 加载环境变量
config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433'),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'AuthForge',
  entities: [User, RefreshToken, OAuthProvider, VerificationCode, MfaDevice, FileMetadata],
  migrations: [__dirname + '/migrations/*.js'],
  migrationsTableName: 'migrations',
  synchronize: false, // 生产环境应该关闭
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default AppDataSource;
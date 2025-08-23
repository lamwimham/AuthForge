import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

export enum OAuthProviderType {
  GOOGLE = 'google',
  GITHUB = 'github',
  WECHAT = 'wechat',
  APPLE = 'apple',
}

@Entity('oauth_providers')
@Index(['userId'])
@Index(['provider', 'providerUserId'])
@Unique(['provider', 'providerUserId'])
export class OAuthProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: OAuthProviderType,
  })
  provider: OAuthProviderType;

  @Column({ name: 'provider_user_id' })
  providerUserId: string;

  @Column({ name: 'access_token', nullable: true })
  accessToken?: string;

  @Column({ name: 'refresh_token', nullable: true })
  refreshToken?: string;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.oauthProviders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 业务方法
  isTokenExpired(): boolean {
    if (!this.expiresAt) {
      return false; // 永不过期
    }
    return this.expiresAt < new Date();
  }

  updateTokens(accessToken: string, refreshToken?: string, expiresAt?: Date): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
    this.expiresAt = expiresAt;
  }
}
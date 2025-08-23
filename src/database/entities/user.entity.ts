import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { RefreshToken } from './refresh-token.entity';
import { OAuthProvider } from './oauth-provider.entity';
import { MfaDevice } from './mfa-device.entity';

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  DISABLED = 'disabled',
  PENDING = 'pending',
}

@Entity('users')
@Index(['email'])
@Index(['phone'])
@Index(['username'])
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  email?: string;

  @Column({ unique: true, nullable: true })
  phone?: string;

  @Column({ unique: true, nullable: true })
  username?: string;

  @Column({ name: 'password_hash', select: false })
  @Exclude()
  passwordHash: string;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', default: false })
  phoneVerified: boolean;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_secret', nullable: true, select: false })
  @Exclude()
  mfaSecret?: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', nullable: true })
  lockedUntil?: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => OAuthProvider, (provider) => provider.user)
  oauthProviders: OAuthProvider[];

  @OneToMany(() => MfaDevice, (device) => device.user)
  mfaDevices: MfaDevice[];

  // 业务方法
  isLocked(): boolean {
    return (
      this.status === UserStatus.LOCKED ||
      (!!this.lockedUntil && this.lockedUntil > new Date())
    );
  }

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE && !this.isLocked();
  }

  hasVerifiedContact(): boolean {
    return this.emailVerified || this.phoneVerified;
  }

  incrementFailedAttempts(): void {
    this.failedLoginAttempts += 1;
    
    // 5次失败后锁定15分钟
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = undefined;
    this.lastLoginAt = new Date();
  }

  /**
   * 检查是否有活跃的MFA设备
   */
  hasActiveMfaDevices(): boolean {
    return this.mfaEnabled && this.mfaDevices?.some(device => device.isActive());
  }

  /**
   * 获取活跃的MFA设备
   */
  getActiveMfaDevices(): MfaDevice[] {
    return this.mfaDevices?.filter(device => device.isActive()) || [];
  }
}
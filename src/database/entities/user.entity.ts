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

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

@Entity('users')
@Index(['email'])
@Index(['phone'])
@Index(['username'])
@Index(['status'])
@Index(['firstName'])
@Index(['lastName'])
@Index(['gender'])
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

  // 个人信息字段
  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ nullable: true })
  birthday?: Date;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

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

  // 新增个人信息业务方法
  /**
   * 获取完整姓名
   */
  getFullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }

  /**
   * 获取显示名称
   */
  getDisplayName(): string {
    return this.getFullName() || this.username || this.email?.split('@')[0] || 'User';
  }

  /**
   * 检查个人信息是否完整
   */
  isProfileComplete(): boolean {
    return !!(this.firstName && this.lastName);
  }

  /**
   * 获取年龄（如果生日已设置）
   */
  getAge(): number | null {
    if (!this.birthday) return null;
    
    const today = new Date();
    const birthDate = new Date(this.birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * 检查是否有头像
   */
  hasAvatar(): boolean {
    return !!this.avatar;
  }
}
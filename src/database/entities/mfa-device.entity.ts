import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum MfaDeviceType {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
  BACKUP_CODES = 'backup_codes',
}

export enum MfaDeviceStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity('mfa_devices')
@Index(['userId', 'type'])
@Index(['userId', 'status'])
export class MfaDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, (user) => user.mfaDevices)
  user: User;

  @Column({
    type: 'enum',
    enum: MfaDeviceType,
  })
  type: MfaDeviceType;

  @Column({
    type: 'enum',
    enum: MfaDeviceStatus,
    default: MfaDeviceStatus.PENDING,
  })
  status: MfaDeviceStatus;

  @Column({ length: 100, nullable: true })
  name: string;

  // TOTP密钥（加密存储）
  @Column({ length: 500, nullable: true })
  secret: string;

  // 手机号或邮箱（用于SMS/Email MFA）
  @Column({ length: 255, nullable: true })
  target: string;

  // 备份代码（JSON格式存储）
  @Column({ type: 'text', nullable: true })
  backupCodes: string;

  // 最后使用时间
  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  // 使用次数
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * 检查设备是否可用
   */
  isActive(): boolean {
    return this.status === MfaDeviceStatus.ACTIVE;
  }

  /**
   * 激活设备
   */
  activate(): void {
    this.status = MfaDeviceStatus.ACTIVE;
  }

  /**
   * 禁用设备
   */
  disable(): void {
    this.status = MfaDeviceStatus.DISABLED;
  }

  /**
   * 记录使用
   */
  recordUsage(): void {
    this.lastUsedAt = new Date();
    this.usageCount += 1;
  }

  /**
   * 获取备份代码列表
   */
  getBackupCodes(): string[] {
    if (!this.backupCodes) {
      return [];
    }
    try {
      return JSON.parse(this.backupCodes);
    } catch {
      return [];
    }
  }

  /**
   * 设置备份代码
   */
  setBackupCodes(codes: string[]): void {
    this.backupCodes = JSON.stringify(codes);
  }

  /**
   * 使用备份代码
   */
  useBackupCode(code: string): boolean {
    const codes = this.getBackupCodes();
    const index = codes.indexOf(code);
    if (index === -1) {
      return false;
    }
    
    codes.splice(index, 1);
    this.setBackupCodes(codes);
    this.recordUsage();
    return true;
  }
}
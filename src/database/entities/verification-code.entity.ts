import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum VerificationType {
  REGISTER = 'register',
  RESET_PASSWORD = 'reset_password',
  LOGIN_MFA = 'login_mfa',
  EMAIL_VERIFY = 'email_verify',
  PHONE_VERIFY = 'phone_verify',
}

@Entity('verification_codes')
@Index(['target', 'type'])
@Index(['expiresAt'])
export class VerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  target: string; // 邮箱或手机号

  @Column({ nullable: true })
  userId?: string; // 用户ID，可选

  @Column({ name: 'code_hash' })
  codeHash: string; // 验证码的哈希值

  @Column({
    type: 'enum',
    enum: VerificationType,
  })
  type: VerificationType;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @Column({ default: 0 })
  attempts: number; // 验证尝试次数

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 业务方法
  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isValid(): boolean {
    return !this.used && !this.isExpired() && this.attempts < 3;
  }

  incrementAttempts(): void {
    this.attempts += 1;
  }

  markAsUsed(): void {
    this.used = true;
  }

  canRetry(): boolean {
    return this.attempts < 3;
  }
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * SSO 会话实体
 * 用于实现跨应用自动登录
 */
@Entity('sso_sessions')
@Index(['sessionHash'], { unique: true })
@Index(['userId'])
@Index(['expiresAt'])
export class SSOSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 会话哈希 */
  @Column({ name: 'session_hash', unique: true, length: 255 })
  sessionHash: string;

  /** 用户 ID */
  @Column({ name: 'user_id' })
  userId: string;

  /** 过期时间 */
  @Column({ name: 'expires_at' })
  expiresAt: Date;

  /** 最后活动时间 */
  @Column({ name: 'last_activity_at' })
  lastActivityAt: Date;

  /** IP 地址 */
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  /** 用户代理 */
  @Column({ name: 'user_agent', nullable: true, length: 500 })
  userAgent?: string;

  /** 设备信息 */
  @Column({ name: 'device_info', nullable: true, type: 'text' })
  deviceInfo?: string;

  /** 是否已登出 */
  @Column({ name: 'is_logged_out', default: false })
  isLoggedOut: boolean;

  /** 已授权的客户端列表（JSON 数组） */
  @Column({ name: 'authorized_clients', type: 'jsonb', nullable: true })
  authorizedClients?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 业务方法

  /**
   * 检查会话是否过期
   */
  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  /**
   * 检查会话是否有效
   */
  isValid(): boolean {
    return !this.isExpired() && !this.isLoggedOut;
  }

  /**
   * 更新活动时间
   */
  updateActivity(): void {
    this.lastActivityAt = new Date();
  }

  /**
   * 登出
   */
  logout(): void {
    this.isLoggedOut = true;
  }

  /**
   * 添加已授权的客户端
   */
  addAuthorizedClient(clientId: string): void {
    if (!this.authorizedClients) {
      this.authorizedClients = [];
    }
    if (!this.authorizedClients.includes(clientId)) {
      this.authorizedClients.push(clientId);
    }
  }

  /**
   * 检查客户端是否已授权
   */
  isClientAuthorized(clientId: string): boolean {
    return this.authorizedClients?.includes(clientId) ?? false;
  }
}
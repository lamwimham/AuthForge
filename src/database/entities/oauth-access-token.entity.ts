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
import { OAuthClient } from './oauth-client.entity';

/**
 * OAuth 访问令牌实体
 * 用于 SSO 令牌管理
 */
@Entity('oauth_access_tokens')
@Index(['tokenHash'], { unique: true })
@Index(['userId'])
@Index(['clientId'])
@Index(['expiresAt'])
export class OAuthAccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 令牌哈希 */
  @Column({ name: 'token_hash', unique: true, length: 255 })
  tokenHash: string;

  /** 客户端 ID */
  @Column({ name: 'client_id' })
  clientId: string;

  /** 用户 ID */
  @Column({ name: 'user_id' })
  userId: string;

  /** 授权范围（JSON 数组） */
  @Column({ type: 'jsonb' })
  scope: string[];

  /** 过期时间 */
  @Column({ name: 'expires_at' })
  expiresAt: Date;

  /** 撤销时间 */
  @Column({ name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  /** 撤销原因 */
  @Column({ name: 'revoke_reason', nullable: true, length: 255 })
  revokeReason?: string;

  /** IP 地址 */
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  /** 用户代理 */
  @Column({ name: 'user_agent', nullable: true, length: 500 })
  userAgent?: string;

  /** JWT ID (jti) */
  @Column({ name: 'jti', nullable: true, length: 64 })
  jti?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => OAuthClient, (client) => client.accessTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 业务方法

  /**
   * 检查令牌是否过期
   */
  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  /**
   * 检查令牌是否已撤销
   */
  isRevoked(): boolean {
    return !!this.revokedAt;
  }

  /**
   * 检查令牌是否有效
   */
  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  /**
   * 撤销令牌
   */
  revoke(reason?: string): void {
    this.revokedAt = new Date();
    this.revokeReason = reason;
  }

  /**
   * 检查是否包含指定权限范围
   */
  hasScope(scope: string): boolean {
    return this.scope.includes(scope);
  }

  /**
   * 检查是否包含所有指定权限范围
   */
  hasScopes(scopes: string[]): boolean {
    return scopes.every((s) => this.scope.includes(s));
  }

  /**
   * 获取剩余有效时间（秒）
   */
  getRemainingTtl(): number {
    if (this.isExpired()) return 0;
    return Math.floor((this.expiresAt.getTime() - Date.now()) / 1000);
  }
}
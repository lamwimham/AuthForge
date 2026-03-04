import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { OAuthClient } from './oauth-client.entity';

/**
 * OAuth 授权码实体
 * 用于 Authorization Code Flow
 */
@Entity('oauth_authorization_codes')
@Index(['codeHash'], { unique: true })
@Index(['userId'])
@Index(['clientId'])
@Index(['expiresAt'])
export class OAuthAuthorizationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 授权码哈希 */
  @Column({ name: 'code_hash', unique: true, length: 255 })
  codeHash: string;

  /** 客户端 ID */
  @Column({ name: 'client_id' })
  clientId: string;

  /** 用户 ID */
  @Column({ name: 'user_id' })
  userId: string;

  /** 重定向地址 */
  @Column({ name: 'redirect_uri', length: 500 })
  redirectUri: string;

  /** 授权范围（JSON 数组） */
  @Column({ type: 'jsonb' })
  scope: string[];

  /** PKCE code_challenge */
  @Column({ name: 'code_challenge', nullable: true, length: 128 })
  codeChallenge?: string;

  /** PKCE code_challenge_method */
  @Column({ name: 'code_challenge_method', nullable: true, length: 10 })
  codeChallengeMethod?: string;

  /** CSRF 防护 state */
  @Column({ nullable: true, length: 128 })
  state?: string;

  /** 随机数，用于重放攻击防护 */
  @Column({ nullable: true, length: 64 })
  nonce?: string;

  /** 过期时间 */
  @Column({ name: 'expires_at' })
  expiresAt: Date;

  /** 使用时间 */
  @Column({ name: 'used_at', nullable: true })
  usedAt?: Date;

  /** IP 地址 */
  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string;

  /** 用户代理 */
  @Column({ name: 'user_agent', nullable: true, length: 500 })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => OAuthClient, (client) => client.authorizationCodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 业务方法

  /**
   * 检查授权码是否过期
   */
  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  /**
   * 检查授权码是否已使用
   */
  isUsed(): boolean {
    return !!this.usedAt;
  }

  /**
   * 检查授权码是否有效
   */
  isValid(): boolean {
    return !this.isExpired() && !this.isUsed();
  }

  /**
   * 标记为已使用
   */
  markAsUsed(): void {
    this.usedAt = new Date();
  }

  /**
   * 验证 PKCE code_verifier
   */
  verifyCodeVerifier(codeVerifier: string): boolean {
    if (!this.codeChallenge) {
      // 没有设置 PKCE，跳过验证
      return true;
    }

    if (!codeVerifier) {
      return false;
    }

    // S256 方法：code_challenge = BASE64URL(SHA256(code_verifier))
    if (this.codeChallengeMethod === 'S256' || !this.codeChallengeMethod) {
      const crypto = require('crypto');
      const hash = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      return hash === this.codeChallenge;
    }

    // plain 方法（不推荐）
    if (this.codeChallengeMethod === 'plain') {
      return codeVerifier === this.codeChallenge;
    }

    return false;
  }
}
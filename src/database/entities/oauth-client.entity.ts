import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { OAuthAuthorizationCode } from './oauth-authorization-code.entity';
import { OAuthAccessToken } from './oauth-access-token.entity';

/**
 * OAuth 客户端类型
 */
export enum ClientType {
  /** 公开客户端，如 SPA、移动应用 */
  PUBLIC = 'public',
  /** 机密客户端，如服务端应用 */
  CONFIDENTIAL = 'confidential',
}

/**
 * OAuth 客户端应用实体
 * 用于 SSO 多应用统一登录
 */
@Entity('oauth_clients')
@Index(['clientId'], { unique: true })
@Index(['userId'])
@Index(['isActive'])
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 客户端 ID（公开标识） */
  @Column({ name: 'client_id', unique: true, length: 64 })
  clientId: string;

  /** 客户端密钥哈希（仅机密客户端） */
  @Column({ name: 'client_secret_hash', nullable: true, length: 255 })
  clientSecretHash?: string;

  /** 客户端名称 */
  @Column({ length: 255 })
  name: string;

  /** 客户端描述 */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** 客户端 Logo URL */
  @Column({ name: 'logo_url', nullable: true, length: 500 })
  logoUrl?: string;

  /** 客户端主页 URL */
  @Column({ name: 'homepage_url', nullable: true, length: 500 })
  homepageUrl?: string;

  /** 允许的回调地址（JSON 数组） */
  @Column({ name: 'redirect_uris', type: 'jsonb' })
  redirectUris: string[];

  /** 允许的登出回调地址（JSON 数组） */
  @Column({ name: 'post_logout_redirect_uris', type: 'jsonb', nullable: true })
  postLogoutRedirectUris?: string[];

  /** 允许的权限范围（JSON 数组） */
  @Column({ name: 'allowed_scopes', type: 'jsonb' })
  allowedScopes: string[];

  /** 客户端类型 */
  @Column({
    name: 'client_type',
    type: 'enum',
    enum: ClientType,
    default: ClientType.CONFIDENTIAL,
  })
  clientType: ClientType;

  /** 是否启用 PKCE（公开客户端必须启用） */
  @Column({ name: 'require_pkce', default: false })
  requirePkce: boolean;

  /** 是否激活 */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** 是否跳过用户授权确认（已信任的应用） */
  @Column({ name: 'skip_consent', default: false })
  skipConsent: boolean;

  /** Access Token 有效期（秒） */
  @Column({ name: 'access_token_ttl', default: 3600 })
  accessTokenTtl: number;

  /** Refresh Token 有效期（秒） */
  @Column({ name: 'refresh_token_ttl', default: 2592000 }) // 30 天
  refreshTokenTtl: number;

  /** 所属用户（开发者） */
  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @OneToMany(() => OAuthAuthorizationCode, (code) => code.client)
  authorizationCodes: OAuthAuthorizationCode[];

  @OneToMany(() => OAuthAccessToken, (token) => token.client)
  accessTokens: OAuthAccessToken[];

  // 业务方法

  /**
   * 检查是否为机密客户端
   */
  isConfidential(): boolean {
    return this.clientType === ClientType.CONFIDENTIAL;
  }

  /**
   * 检查回调地址是否合法
   */
  isValidRedirectUri(uri: string): boolean {
    return this.redirectUris.some(
      (allowed) => allowed === uri || this.matchWildcard(allowed, uri),
    );
  }

  /**
   * 检查权限范围是否允许
   */
  isScopeAllowed(scopes: string[]): boolean {
    return scopes.every((scope) => this.allowedScopes.includes(scope));
  }

  /**
   * 通配符匹配
   */
  private matchWildcard(pattern: string, uri: string): boolean {
    if (!pattern.includes('*')) return false;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(uri);
  }
}
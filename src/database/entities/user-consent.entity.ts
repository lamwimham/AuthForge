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
 * 用户授权确认实体
 * 记录用户对各客户端的授权状态
 */
@Entity('user_consents')
@Index(['userId', 'clientId'], { unique: true })
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 用户 ID */
  @Column({ name: 'user_id' })
  userId: string;

  /** 客户端 ID */
  @Column({ name: 'client_id' })
  clientId: string;

  /** 已授权的范围（JSON 数组） */
  @Column({ type: 'jsonb' })
  scopes: string[];

  /** 是否已撤销 */
  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  /** 最后授权时间 */
  @Column({ name: 'last_granted_at' })
  lastGrantedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => OAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  // 业务方法

  /**
   * 检查是否包含指定权限范围
   */
  hasScope(scope: string): boolean {
    return this.scopes.includes(scope);
  }

  /**
   * 检查是否包含所有指定权限范围
   */
  hasScopes(scopes: string[]): boolean {
    return scopes.every((s) => this.scopes.includes(s));
  }

  /**
   * 更新授权范围
   */
  updateScopes(scopes: string[]): void {
    // 合并新旧范围
    const newScopes = new Set([...this.scopes, ...scopes]);
    this.scopes = Array.from(newScopes);
    this.lastGrantedAt = new Date();
  }

  /**
   * 撤销授权
   */
  revoke(): void {
    this.isRevoked = true;
  }

  /**
   * 检查授权是否有效
   */
  isValid(): boolean {
    return !this.isRevoked;
  }
}
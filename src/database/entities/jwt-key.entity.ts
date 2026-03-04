import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * JWT 密钥实体
 * 用于存储 RSA 密钥对，支持密钥轮换
 */
@Entity('jwt_keys')
@Index(['isActive'])
@Index(['expiresAt'])
export class JwtKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 密钥 ID (kid) */
  @Column({ name: 'key_id', unique: true, length: 64 })
  keyId: string;

  /** 密钥算法 */
  @Column({ length: 20, default: 'RS256' })
  algorithm: string;

  /** 私钥 (PEM 格式) */
  @Column({ name: 'private_key', type: 'text' })
  privateKey: string;

  /** 公钥 (PEM 格式) */
  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  /** JWK 格式的公钥 (JSON) */
  @Column({ name: 'public_jwk', type: 'jsonb' })
  publicJwk: Record<string, unknown>;

  /** 是否为活跃密钥 */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** 密钥创建时间 */
  @Column({ name: 'key_created_at' })
  keyCreatedAt: Date;

  /** 密钥过期时间（用于轮换） */
  @Column({ name: 'expires_at', nullable: true })
  expiresAt?: Date;

  /** 是否已轮换 */
  @Column({ name: 'is_rotated', default: false })
  isRotated: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // 业务方法

  /**
   * 检查密钥是否过期
   */
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt < new Date();
  }

  /**
   * 检查密钥是否可用
   */
  isUsable(): boolean {
    return this.isActive && !this.isRotated && !this.isExpired();
  }

  /**
   * 标记为已轮换
   */
  markAsRotated(): void {
    this.isRotated = true;
    this.isActive = false;
  }
}
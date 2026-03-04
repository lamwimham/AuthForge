import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { JwtKey } from '../../database/entities/jwt-key.entity';

/**
 * JWK (JSON Web Key) 格式接口
 */
export interface JWK {
  kty: string; // Key Type
  kid: string; // Key ID
  use: string; // Public Key Use
  alg: string; // Algorithm
  n: string; // Modulus
  e: string; // Exponent
}

/**
 * JWKS (JSON Web Key Set) 格式接口
 */
export interface JWKS {
  keys: JWK[];
}

/**
 * RSA 密钥管理服务
 * 用于 JWT 签名验证和 OIDC JWKS 端点支持
 */
@Injectable()
export class JwksService implements OnModuleInit {
  private readonly logger = new Logger(JwksService.name);
  private readonly keyRotationDays: number;
  private currentKeyId: string | null = null;

  constructor(
    @InjectRepository(JwtKey)
    private jwtKeyRepository: Repository<JwtKey>,
    private configService: ConfigService,
  ) {
    this.keyRotationDays = this.configService.get<number>(
      'JWT_KEY_ROTATION_DAYS',
      30,
    );
  }

  /**
   * 模块初始化时确保有活跃密钥
   */
  async onModuleInit(): Promise<void> {
    await this.ensureActiveKey();
  }

  /**
   * 获取当前活跃的私钥（用于签名）
   */
  async getActivePrivateKey(): Promise<{ privateKey: string; keyId: string }> {
    let activeKey = await this.jwtKeyRepository.findOne({
      where: { isActive: true, isRotated: false },
      order: { keyCreatedAt: 'DESC' },
    });

    if (!activeKey) {
      activeKey = await this.ensureActiveKey();
    }

    this.currentKeyId = activeKey.keyId;
    return {
      privateKey: activeKey.privateKey,
      keyId: activeKey.keyId,
    };
  }

  /**
   * 获取指定 keyId 的公钥（用于验证）
   */
  async getPublicKey(keyId: string): Promise<string | null> {
    const key = await this.jwtKeyRepository.findOne({
      where: { keyId },
    });

    return key?.publicKey || null;
  }

  /**
   * 获取 JWKS（公开密钥集）
   */
  async getJwks(): Promise<JWKS> {
    // 返回所有活跃和未轮换的密钥（允许验证旧令牌）
    const keys = await this.jwtKeyRepository.find({
      where: { isActive: true },
      order: { keyCreatedAt: 'DESC' },
      take: 3, // 最多保留 3 个密钥用于验证
    });

    const jwks: JWK[] = keys.map((key) => this.convertToJwk(key));

    return { keys: jwks };
  }

  /**
   * 确保有活跃密钥
   */
  async ensureActiveKey(): Promise<JwtKey> {
    // 检查当前活跃密钥
    const activeKey = await this.jwtKeyRepository.findOne({
      where: { isActive: true, isRotated: false },
      order: { keyCreatedAt: 'DESC' },
    });

    if (activeKey && !activeKey.isExpired()) {
      return activeKey;
    }

    // 需要生成新密钥
    return this.generateNewKey();
  }

  /**
   * 轮换密钥
   */
  async rotateKey(): Promise<JwtKey> {
    this.logger.log('Starting key rotation...');

    // 标记当前活跃密钥为已轮换
    if (this.currentKeyId) {
      await this.jwtKeyRepository.update(
        { keyId: this.currentKeyId },
        { isRotated: true, isActive: false },
      );
    }

    // 生成新密钥
    const newKey = await this.generateNewKey();

    this.logger.log(`Key rotation completed. New key ID: ${newKey.keyId}`);

    return newKey;
  }

  /**
   * 生成新的 RSA 密钥对
   */
  private async generateNewKey(): Promise<JwtKey> {
    const keyId = this.generateKeyId();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // 转换公钥为 JWK 格式
    const publicJwk = this.convertPublicKeyToJwk(publicKey, keyId);

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.keyRotationDays);

    const jwtKey = this.jwtKeyRepository.create({
      keyId,
      algorithm: 'RS256',
      privateKey,
      publicKey,
      publicJwk: publicJwk as unknown as Record<string, unknown>,
      isActive: true,
      keyCreatedAt: new Date(),
      expiresAt,
    });

    await this.jwtKeyRepository.save(jwtKey);

    this.logger.log(`Generated new RSA key pair. Key ID: ${keyId}`);

    return jwtKey;
  }

  /**
   * 生成密钥 ID
   */
  private generateKeyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 将公钥转换为 JWK 格式
   */
  private convertPublicKeyToJwk(publicKey: string, keyId: string): JWK {
    // 解析 PEM 格式的公钥
    const keyObject = crypto.createPublicKey(publicKey);
    const jwkKey = keyObject.export({ format: 'jwk' });

    return {
      kty: 'RSA',
      kid: keyId,
      use: 'sig',
      alg: 'RS256',
      n: jwkKey.n as string,
      e: jwkKey.e as string,
    };
  }

  /**
   * 将数据库实体转换为 JWK
   */
  private convertToJwk(key: JwtKey): JWK {
    return {
      kty: 'RSA',
      kid: key.keyId,
      use: 'sig',
      alg: key.algorithm,
      n: (key.publicJwk.n as string) || '',
      e: (key.publicJwk.e as string) || 'AQAB',
    };
  }

  /**
   * 清理过期密钥
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.jwtKeyRepository
      .createQueryBuilder()
      .delete()
      .where('isRotated = :isRotated', { isRotated: true })
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired keys`);
    }

    return result.affected || 0;
  }

  /**
   * 获取所有活跃密钥（用于验证令牌时查找）
   */
  async getAllActiveKeys(): Promise<JwtKey[]> {
    return this.jwtKeyRepository.find({
      where: { isActive: true },
      order: { keyCreatedAt: 'DESC' },
    });
  }
}
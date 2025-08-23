import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Redis } from 'ioredis';

export interface JWTPayload {
  sub: string; // 用户ID
  email?: string;
  username?: string;
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @Inject(REDIS_CLIENT)
    private redis: Redis,
  ) {
    this.accessTokenExpiresIn = this.configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN', '15m');
    this.refreshTokenExpiresIn = this.configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN', '7d');
  }

  /**
   * 生成访问令牌
   */
  generateAccessToken(payload: JWTPayload): string {
    const jwtPayload = {
      ...payload,
      jti: this.generateJTI(),
    };

    return this.jwtService.sign(jwtPayload, {
      expiresIn: this.accessTokenExpiresIn,
    });
  }

  /**
   * 生成刷新令牌
   */
  async generateRefreshToken(
    userId: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<string> {
    const token = this.generateSecureToken();
    const tokenHash = this.hashToken(token);
    
    // 计算过期时间
    const expiresAt = this.calculateExpiryDate(this.refreshTokenExpiresIn);

    // 保存到数据库
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      deviceInfo,
      ipAddress,
    });

    await this.refreshTokenRepository.save(refreshToken);

    return token;
  }

  /**
   * 生成完整的认证令牌对
   */
  async generateAuthTokens(
    user: User,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<AuthTokens> {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(user.id, deviceInfo, ipAddress);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(this.accessTokenExpiresIn),
    };
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = this.jwtService.verify(token) as JWTPayload;
      
      // 检查令牌是否在黑名单中
      if (payload.jti) {
        const isBlacklisted = await this.isTokenBlacklisted(payload.jti);
        if (isBlacklisted) {
          return null;
        }
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * 验证刷新令牌
   */
  async verifyRefreshToken(token: string): Promise<RefreshToken | null> {
    try {
      const tokenHash = this.hashToken(token);
      
      const refreshToken = await this.refreshTokenRepository.findOne({
        where: { tokenHash },
        relations: ['user'],
      });

      if (!refreshToken || !refreshToken.isValid()) {
        return null;
      }

      return refreshToken;
    } catch (error) {
      return null;
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens | null> {
    const tokenRecord = await this.verifyRefreshToken(refreshToken);
    if (!tokenRecord) {
      return null;
    }

    // 生成新的令牌对
    return this.generateAuthTokens(
      tokenRecord.user,
      tokenRecord.deviceInfo,
      tokenRecord.ipAddress,
    );
  }

  /**
   * 吊销刷新令牌
   */
  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { id: tokenId },
      { revoked: true },
    );
  }

  /**
   * 吊销用户的所有刷新令牌
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId },
      { revoked: true },
    );
  }

  /**
   * 将访问令牌加入黑名单
   */
  async blacklistAccessToken(token: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(token) as JWTPayload;
      if (payload?.jti && payload?.exp) {
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redis.set(`blacklist:${payload.jti}`, '1', 'EX', ttl);
        }
      }
    } catch (error) {
      // 忽略解码错误
    }
  }

  /**
   * 检查令牌是否在黑名单中
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    if (!jti) return false;
    
    try {
      const result = await this.redis.get(`blacklist:${jti}`);
      return result === '1';
    } catch (error) {
      return false;
    }
  }

  /**
   * 清理过期的刷新令牌
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }

  /**
   * 获取用户的活跃刷新令牌
   */
  async getUserActiveTokens(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokenRepository.find({
      where: { 
        userId,
        revoked: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 生成安全随机令牌
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 生成JWT ID
   */
  private generateJTI(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 哈希令牌
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 计算过期时间
   */
  private calculateExpiryDate(expiresIn: string): Date {
    const seconds = this.parseExpiresIn(expiresIn);
    return new Date(Date.now() + seconds * 1000);
  }

  /**
   * 解析过期时间字符串到秒数
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }
  }
}
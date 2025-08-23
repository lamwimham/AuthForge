import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';

export interface CacheOptions {
  ttl?: number; // 生存时间（秒）
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 3600; // 1小时

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      this.logger.error(`获取缓存失败: ${key}`, error);
      return null;
    }
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      await this.redis.setex(key, ttl, JSON.stringify(value));
      this.logger.debug(`缓存设置成功: ${key}, TTL: ${ttl}秒`);
    } catch (error) {
      this.logger.error(`设置缓存失败: ${key}`, error);
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string | string[]): Promise<void> {
    try {
      const keys = Array.isArray(key) ? key : [key];
      await this.redis.del(...keys);
      this.logger.debug(`缓存删除成功: ${keys.join(', ')}`);
    } catch (error) {
      this.logger.error(`删除缓存失败: ${key}`, error);
    }
  }

  /**
   * 删除匹配模式的缓存
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`批量删除缓存成功: ${keys.length}个键`);
      }
    } catch (error) {
      this.logger.error(`批量删除缓存失败: ${pattern}`, error);
    }
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`检查缓存键存在性失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 获取键的过期时间
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`获取缓存TTL失败: ${key}`, error);
      return -1;
    }
  }

  /**
   * 设置键的过期时间
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
      this.logger.debug(`设置缓存过期时间成功: ${key}, ${seconds}秒`);
    } catch (error) {
      this.logger.error(`设置缓存过期时间失败: ${key}`, error);
    }
  }

  /**
   * 生成用户信息缓存键
   */
  getUserProfileKey(userId: string): string {
    return `user:profile:${userId}`;
  }

  /**
   * 生成用户统计信息缓存键
   */
  getUserStatsKey(userId: string): string {
    return `user:stats:${userId}`;
  }

  /**
   * 生成用户基础信息缓存键
   */
  getUserBasicInfoKey(userId: string): string {
    return `user:basic:${userId}`;
  }

  /**
   * 清除用户相关的所有缓存
   */
  async clearUserCache(userId: string): Promise<void> {
    const patterns = [
      `user:profile:${userId}`,
      `user:stats:${userId}`,
      `user:basic:${userId}`,
    ];
    
    for (const pattern of patterns) {
      await this.del(pattern);
    }
    
    this.logger.log(`清除用户缓存: ${userId}`);
  }
}
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

export interface RateLimitConfig {
  max: number; // 最大请求次数
  windowMs: number; // 时间窗口（毫秒）
  keyGenerator?: (req: Request) => string; // 自定义key生成函数
  message?: string; // 自定义错误消息
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly defaultMax: number;
  private readonly defaultWindowMs: number;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private redis: Redis,
  ) {
    this.defaultMax = +this.configService.get('RATE_LIMIT_MAX', 5);
    this.defaultWindowMs = +this.configService.get('RATE_LIMIT_WINDOW_MS', 900000); // 15分钟
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitConfig = this.reflector.getAllAndOverride<RateLimitConfig>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置速率限制，则跳过
    if (!rateLimitConfig) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = this.generateKey(request, rateLimitConfig);
    
    const {
      max = this.defaultMax,
      windowMs = this.defaultWindowMs,
      message = '请求过于频繁，请稍后再试',
    } = rateLimitConfig;

    const current = await this.increment(key, windowMs);
    
    if (current > max) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  /**
   * 生成速率限制的key
   */
  private generateKey(request: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(request);
    }

    // 默认使用IP地址和路径作为key
    const ip = this.getClientIp(request);
    const path = request.route?.path || request.path;
    return `rate_limit:${ip}:${path}`;
  }

  /**
   * 递增计数器
   */
  private async increment(key: string, windowMs: number): Promise<number> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, Math.ceil(windowMs / 1000));
    
    const results = await multi.exec();
    const count = results?.[0]?.[1] as number;
    
    return count || 0;
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    
    return (
      forwardedIp?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}
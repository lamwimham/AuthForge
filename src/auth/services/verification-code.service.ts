import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { VerificationCode, VerificationType } from '../../database/entities/verification-code.entity';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

@Injectable()
export class VerificationCodeService {
  constructor(
    @InjectRepository(VerificationCode)
    private verificationCodeRepository: Repository<VerificationCode>,
    private configService: ConfigService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  /**
   * 发送验证码
   */
  async sendVerificationCode(
    target: string,
    type: string,
    userId?: string,
  ): Promise<void> {
    // 检查发送频率限制
    await this.checkRateLimit(target, type);

    // 生成验证码
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟过期

    // 保存验证码
    const verificationCode = this.verificationCodeRepository.create({
      target,
      type: type as VerificationType,
      codeHash: this.hashCode(code),
      expiresAt,
      userId,
    });

    await this.verificationCodeRepository.save(verificationCode);

    // 发送验证码
    if (this.isEmail(target)) {
      await this.emailService.sendVerificationCode(target, code, type);
    } else if (this.isPhoneNumber(target)) {
      await this.smsService.sendVerificationCode(target, code, type);
    } else {
      throw new BadRequestException('无效的目标地址');
    }
  }

  /**
   * 验证验证码
   */
  async verifyCode(
    target: string,
    type: string,
    code: string,
    userId?: string,
  ): Promise<boolean> {
    const verificationCode = await this.verificationCodeRepository.findOne({
      where: {
        target,
        type: type as VerificationType,
        codeHash: this.hashCode(code),
        used: false,
        expiresAt: MoreThan(new Date()),
        ...(userId && { userId }),
      },
    });

    if (!verificationCode) {
      return false;
    }

    // 标记为已使用
    verificationCode.used = true;
    await this.verificationCodeRepository.save(verificationCode);

    return true;
  }

  /**
   * 清理过期的验证码
   */
  async cleanExpiredCodes(): Promise<void> {
    await this.verificationCodeRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  /**
   * 检查发送频率限制
   */
  private async checkRateLimit(target: string, type: string): Promise<void> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    const recentCount = await this.verificationCodeRepository.count({
      where: {
        target,
        type: type as VerificationType,
        createdAt: MoreThan(oneMinuteAgo),
      },
    });

    if (recentCount >= 3) {
      throw new BadRequestException('发送太频繁，请稍后再试');
    }
  }

  /**
   * 生成6位数字验证码
   */
  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * 哈希验证码
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * 检查是否为邮箱地址
   */
  private isEmail(target: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(target);
  }

  /**
   * 检查是否为手机号
   */
  private isPhoneNumber(target: string): boolean {
    const phoneRegex = /^\\+?[1-9]\\d{1,14}$/;
    return phoneRegex.test(target);
  }
}
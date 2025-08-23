import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(private configService: ConfigService) {
    this.saltRounds = +this.configService.get('PASSWORD_SALT_ROUNDS', 12);
  }

  /**
   * 使用 bcrypt 哈希密码
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * 使用 argon2 哈希密码（更安全的选择）
   */
  async hashPasswordArgon2(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * 验证 bcrypt 密码
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证 argon2 密码
   */
  async verifyPasswordArgon2(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证密码强度
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    score: number;
  } {
    const errors: string[] = [];
    let score = 0;

    // 最小长度检查
    if (password.length < 8) {
      errors.push('密码长度至少8位');
    } else {
      score += 1;
    }

    // 大写字母检查
    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母');
    } else {
      score += 1;
    }

    // 小写字母检查
    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含至少一个小写字母');
    } else {
      score += 1;
    }

    // 数字检查
    if (!/\d/.test(password)) {
      errors.push('密码必须包含至少一个数字');
    } else {
      score += 1;
    }

    // 特殊字符检查
    if (!/[@$!%*?&]/.test(password)) {
      errors.push('密码必须包含至少一个特殊字符 (@$!%*?&)');
    } else {
      score += 1;
    }

    // 长度额外加分
    if (password.length >= 12) {
      score += 1;
    }

    // 复杂度额外加分
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      score += 1;
    }

    return {
      isValid: errors.length === 0,
      errors,
      score: Math.min(score, 5), // 最高5分
    };
  }

  /**
   * 生成随机密码
   */
  generateRandomPassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '@$!%*?&';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // 确保至少包含每种类型的字符
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // 填充剩余长度
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // 随机打乱密码字符顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
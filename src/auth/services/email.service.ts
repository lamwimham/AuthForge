import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  /**
   * 初始化邮件传输器
   */
  private initializeTransporter(): void {
    const emailConfig = {
      host: this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('EMAIL_PORT', 587),
      secure: this.configService.get<boolean>('EMAIL_SECURE', false),
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    };

    this.transporter = nodemailer.createTransport(emailConfig);
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCode(
    email: string,
    code: string,
    type: string,
  ): Promise<void> {
    const subject = this.getSubjectByType(type);
    const template = this.getTemplateByType(type, code);

    const mailOptions = {
      from: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@AuthForge.com',
      ),
      to: email,
      subject,
      html: template,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`验证码邮件已发送到 ${email}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`发送邮件失败: ${errorMessage}`);
      throw new Error('邮件发送失败');
    }
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@AuthForge.com',
      ),
      to: email,
      subject: '密码重置请求',
      html: this.getPasswordResetTemplate(resetUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`密码重置邮件已发送到 ${email}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`发送密码重置邮件失败: ${errorMessage}`);
      throw new Error('邮件发送失败');
    }
  }

  /**
   * 根据类型获取邮件主题
   */
  private getSubjectByType(type: string): string {
    const subjects: Record<string, string> = {
      register: '注册验证码',
      reset_password: '密码重置验证码',
      email_verify: '邮箱验证码',
      phone_verify: '手机验证码',
      mfa_setup: 'MFA设置验证码',
      mfa_login: 'MFA登录验证码',
    };

    return subjects[type] || '验证码';
  }

  /**
   * 根据类型获取邮件模板
   */
  private getTemplateByType(type: string, code: string): string {
    const appName = this.configService.get<string>('APP_NAME', 'AuthForge');

    const templates: Record<string, string> = {
      register: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>欢迎注册 ${appName}</h2>
          <p>您的注册验证码是：</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
            ${code}
          </div>
          <p>验证码有效期为10分钟，请及时使用。</p>
          <p>如果您没有注册账户，请忽略此邮件。</p>
        </div>
      `,
      reset_password: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${appName} 密码重置</h2>
          <p>您的密码重置验证码是：</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
            ${code}
          </div>
          <p>验证码有效期为10分钟，请及时使用。</p>
          <p>如果您没有请求重置密码，请忽略此邮件。</p>
        </div>
      `,
      email_verify: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${appName} 邮箱验证</h2>
          <p>您的邮箱验证码是：</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
            ${code}
          </div>
          <p>验证码有效期为10分钟，请及时使用。</p>
        </div>
      `,
      mfa_setup: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${appName} MFA设置</h2>
          <p>您的MFA设置验证码是：</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
            ${code}
          </div>
          <p>验证码有效期为10分钟，请及时使用。</p>
        </div>
      `,
      mfa_login: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${appName} 登录验证</h2>
          <p>您的登录验证码是：</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
            ${code}
          </div>
          <p>验证码有效期为10分钟，请及时使用。</p>
          <p>如果不是您本人操作，请立即检查账户安全。</p>
        </div>
      `,
    };

    return templates[type] || this.getDefaultTemplate(code);
  }

  /**
   * 默认邮件模板
   */
  private getDefaultTemplate(code: string): string {
    const appName = this.configService.get<string>('APP_NAME', 'AuthForge');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${appName} 验证码</h2>
        <p>您的验证码是：</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px;">
          ${code}
        </div>
        <p>验证码有效期为10分钟，请及时使用。</p>
      </div>
    `;
  }

  /**
   * 密码重置邮件模板
   */
  private getPasswordResetTemplate(resetUrl: string): string {
    const appName = this.configService.get<string>('APP_NAME', 'AuthForge');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${appName} 密码重置</h2>
        <p>您请求重置密码，请点击下面的链接：</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">重置密码</a>
        </div>
        <p>或者复制以下链接到浏览器地址栏：</p>
        <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px;">${resetUrl}</p>
        <p>此链接有效期为1小时。如果您没有请求重置密码，请忽略此邮件。</p>
      </div>
    `;
  }
}

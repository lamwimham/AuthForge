import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {}

  /**
   * 发送验证码短信
   */
  async sendVerificationCode(phoneNumber: string, code: string, type: string): Promise<void> {
    const message = this.getMessageByType(type, code);

    // 在开发环境下只记录日志，不实际发送短信
    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.log(`[模拟SMS] 发送到 ${phoneNumber}: ${message}`);
      return;
    }

    try {
      // 这里可以集成真实的SMS服务提供商，如阿里云、腾讯云等
      await this.sendSmsViaTencent(phoneNumber, message);
      this.logger.log(`短信已发送到 ${phoneNumber}`);
    } catch (error) {
      this.logger.error(`发送短信失败: ${error.message}`);
      throw new Error('短信发送失败');
    }
  }

  /**
   * 根据类型获取短信内容
   */
  private getMessageByType(type: string, code: string): string {
    const appName = this.configService.get('APP_NAME', 'AuthForge');
    
    const messages = {
      register: `【${appName}】您的注册验证码是：${code}，有效期10分钟。`,
      reset_password: `【${appName}】您的密码重置验证码是：${code}，有效期10分钟。`,
      phone_verify: `【${appName}】您的手机验证码是：${code}，有效期10分钟。`,
      mfa_setup: `【${appName}】您的MFA设置验证码是：${code}，有效期10分钟。`,
      mfa_login: `【${appName}】您的登录验证码是：${code}，有效期10分钟。如非本人操作请忽略。`,
    };

    return messages[type] || `【${appName}】您的验证码是：${code}，有效期10分钟。`;
  }

  /**
   * 通过腾讯云发送短信（示例实现）
   */
  private async sendSmsViaTencent(phoneNumber: string, message: string): Promise<void> {
    // 这里是腾讯云SMS的示例实现
    // 实际使用时需要安装腾讯云SDK并配置相关参数
    
    const secretId = this.configService.get('TENCENT_SECRET_ID');
    const secretKey = this.configService.get('TENCENT_SECRET_KEY');
    const appId = this.configService.get('TENCENT_SMS_APP_ID');
    const sign = this.configService.get('TENCENT_SMS_SIGN');
    
    if (!secretId || !secretKey || !appId || !sign) {
      throw new Error('腾讯云SMS配置不完整');
    }

    // 示例：使用腾讯云SDK发送短信
    // const tencentcloud = require('tencentcloud-sdk-nodejs');
    // const SmsClient = tencentcloud.sms.v20210111.Client;
    
    // const clientConfig = {
    //   credential: {
    //     secretId,
    //     secretKey,
    //   },
    //   region: 'ap-beijing',
    //   profile: {
    //     httpProfile: {
    //       endpoint: 'sms.tencentcloudapi.com',
    //     },
    //   },
    // };
    
    // const client = new SmsClient(clientConfig);
    // const params = {
    //   PhoneNumberSet: [phoneNumber],
    //   SmsSdkAppId: appId,
    //   Sign: sign,
    //   TemplateId: 'your_template_id',
    //   TemplateParamSet: [code, '10'],
    // };
    
    // await client.SendSms(params);
    
    // 在没有配置的情况下，抛出错误提示
    throw new Error('SMS服务尚未配置，请配置腾讯云或其他SMS服务提供商');
  }

  /**
   * 通过阿里云发送短信（示例实现）
   */
  private async sendSmsViaAliyun(phoneNumber: string, message: string): Promise<void> {
    // 这里是阿里云SMS的示例实现
    // 实际使用时需要安装阿里云SDK并配置相关参数
    
    const accessKeyId = this.configService.get('ALIYUN_ACCESS_KEY_ID');
    const accessKeySecret = this.configService.get('ALIYUN_ACCESS_KEY_SECRET');
    const signName = this.configService.get('ALIYUN_SMS_SIGN_NAME');
    const templateCode = this.configService.get('ALIYUN_SMS_TEMPLATE_CODE');
    
    if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
      throw new Error('阿里云SMS配置不完整');
    }

    // 示例：使用阿里云SDK发送短信
    // const Core = require('@alicloud/pop-core');
    
    // const client = new Core({
    //   accessKeyId,
    //   accessKeySecret,
    //   endpoint: 'https://dysmsapi.aliyuncs.com',
    //   apiVersion: '2017-05-25'
    // });
    
    // const params = {
    //   PhoneNumbers: phoneNumber,
    //   SignName: signName,
    //   TemplateCode: templateCode,
    //   TemplateParam: JSON.stringify({ code }),
    // };
    
    // await client.request('SendSms', params, { method: 'POST' });
    
    // 在没有配置的情况下，抛出错误提示
    throw new Error('SMS服务尚未配置，请配置阿里云或其他SMS服务提供商');
  }
}
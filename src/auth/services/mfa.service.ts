import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import { MfaDevice, MfaDeviceType, MfaDeviceStatus } from '../../database/entities/mfa-device.entity';
import { User } from '../../database/entities/user.entity';
import { VerificationCodeService } from './verification-code.service';

export interface MfaSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MfaVerificationResult {
  success: boolean;
  deviceUsed?: MfaDevice;
  backupCodeUsed?: boolean;
}

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(MfaDevice)
    private mfaDeviceRepository: Repository<MfaDevice>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private verificationCodeService: VerificationCodeService,
  ) {}

  /**
   * 设置TOTP设备
   */
  async setupTotpDevice(userId: string, deviceName: string): Promise<MfaSetupResponse> {
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      select: ['id', 'email', 'username']
    });
    
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const secret = speakeasy.generateSecret({
      name: `${user.email || user.username}`,
      issuer: this.configService.get('APP_NAME', 'AuthForge'),
      length: 32,
    });

    const device = this.mfaDeviceRepository.create({
      userId,
      type: MfaDeviceType.TOTP,
      name: deviceName,
      secret: this.encryptSecret(secret.base32),
      status: MfaDeviceStatus.PENDING,
    });

    await this.mfaDeviceRepository.save(device);

    // 生成备份代码
    const backupCodes = this.generateBackupCodes();
    await this.setupBackupCodes(userId, backupCodes);

    // 生成二维码URL
    const qrCodeUrl = secret.otpauth_url 
      ? await qrcode.toDataURL(secret.otpauth_url)
      : '';

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * 设置SMS设备
   */
  async setupSmsDevice(userId: string, phoneNumber: string, deviceName: string): Promise<void> {
    const device = this.mfaDeviceRepository.create({
      userId,
      type: MfaDeviceType.SMS,
      name: deviceName,
      target: phoneNumber,
      status: MfaDeviceStatus.PENDING,
    });

    await this.mfaDeviceRepository.save(device);
    
    // 发送验证码
    await this.verificationCodeService.sendVerificationCode(
      phoneNumber,
      'mfa_setup',
      userId,
    );
  }

  /**
   * 设置Email设备
   */
  async setupEmailDevice(userId: string, email: string, deviceName: string): Promise<void> {
    const device = this.mfaDeviceRepository.create({
      userId,
      type: MfaDeviceType.EMAIL,
      name: deviceName,
      target: email,
      status: MfaDeviceStatus.PENDING,
    });

    await this.mfaDeviceRepository.save(device);
    
    // 发送验证码
    await this.verificationCodeService.sendVerificationCode(
      email,
      'mfa_setup',
      userId,
    );
  }

  /**
   * 验证MFA设备设置
   */
  async verifyMfaSetup(userId: string, deviceId: string, code: string): Promise<void> {
    const device = await this.mfaDeviceRepository.findOne({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('MFA设备不存在');
    }

    if (device.status !== MfaDeviceStatus.PENDING) {
      throw new BadRequestException('设备已激活或已禁用');
    }

    let isValid = false;

    switch (device.type) {
      case MfaDeviceType.TOTP:
        isValid = this.verifyTotpCode(device.secret, code);
        break;
      case MfaDeviceType.SMS:
      case MfaDeviceType.EMAIL:
        isValid = await this.verificationCodeService.verifyCode(
          device.target,
          'mfa_setup',
          code,
          userId,
        );
        break;
    }

    if (!isValid) {
      throw new BadRequestException('验证码无效');
    }

    device.activate();
    await this.mfaDeviceRepository.save(device);

    // 如果这是用户的第一个MFA设备，启用MFA
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user && !user.mfaEnabled) {
      user.mfaEnabled = true;
      await this.userRepository.save(user);
    }
  }

  /**
   * 验证MFA代码
   */
  async verifyMfaCode(userId: string, code: string): Promise<MfaVerificationResult> {
    const devices = await this.mfaDeviceRepository.find({
      where: { userId, status: MfaDeviceStatus.ACTIVE },
    });

    if (devices.length === 0) {
      throw new BadRequestException('用户没有激活的MFA设备');
    }

    // 首先尝试备份代码
    const backupDevice = devices.find(d => d.type === MfaDeviceType.BACKUP_CODES);
    if (backupDevice && backupDevice.useBackupCode(code)) {
      await this.mfaDeviceRepository.save(backupDevice);
      return { success: true, deviceUsed: backupDevice, backupCodeUsed: true };
    }

    // 然后尝试其他设备
    for (const device of devices) {
      if (device.type === MfaDeviceType.BACKUP_CODES) continue;

      let isValid = false;

      switch (device.type) {
        case MfaDeviceType.TOTP:
          isValid = this.verifyTotpCode(device.secret, code);
          break;
        case MfaDeviceType.SMS:
        case MfaDeviceType.EMAIL:
          isValid = await this.verificationCodeService.verifyCode(
            device.target,
            'mfa_login',
            code,
            userId,
          );
          break;
      }

      if (isValid) {
        device.recordUsage();
        await this.mfaDeviceRepository.save(device);
        return { success: true, deviceUsed: device };
      }
    }

    return { success: false };
  }

  /**
   * 发送MFA登录验证码
   */
  async sendMfaLoginCode(userId: string, deviceId: string): Promise<void> {
    const device = await this.mfaDeviceRepository.findOne({
      where: { id: deviceId, userId, status: MfaDeviceStatus.ACTIVE },
    });

    if (!device) {
      throw new NotFoundException('MFA设备不存在或未激活');
    }

    if (device.type !== MfaDeviceType.SMS && device.type !== MfaDeviceType.EMAIL) {
      throw new BadRequestException('该设备类型不支持发送验证码');
    }

    await this.verificationCodeService.sendVerificationCode(
      device.target,
      'mfa_login',
      userId,
    );
  }

  /**
   * 获取用户的MFA设备列表
   */
  async getUserMfaDevices(userId: string): Promise<MfaDevice[]> {
    return this.mfaDeviceRepository.find({
      where: { userId },
      select: ['id', 'type', 'name', 'status', 'target', 'createdAt', 'lastUsedAt', 'usageCount'],
    });
  }

  /**
   * 禁用MFA设备
   */
  async disableMfaDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.mfaDeviceRepository.findOne({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('MFA设备不存在');
    }

    device.disable();
    await this.mfaDeviceRepository.save(device);

    // 检查是否还有其他活跃设备
    const activeDevices = await this.mfaDeviceRepository.count({
      where: { userId, status: MfaDeviceStatus.ACTIVE },
    });

    // 如果没有活跃设备，禁用用户的MFA
    if (activeDevices === 0) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        user.mfaEnabled = false;
        await this.userRepository.save(user);
      }
    }
  }

  /**
   * 生成新的备份代码
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = this.generateBackupCodes();
    await this.setupBackupCodes(userId, backupCodes);
    return backupCodes;
  }

  /**
   * 验证TOTP代码
   */
  private verifyTotpCode(encryptedSecret: string, code: string): boolean {
    const secret = this.decryptSecret(encryptedSecret);
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1, // 允许前后1个时间窗口的误差
    });
  }

  /**
   * 生成备份代码
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * 设置备份代码
   */
  private async setupBackupCodes(userId: string, codes: string[]): Promise<void> {
    // 删除现有备份代码设备
    await this.mfaDeviceRepository.delete({
      userId,
      type: MfaDeviceType.BACKUP_CODES,
    });

    // 创建新的备份代码设备
    const device = this.mfaDeviceRepository.create({
      userId,
      type: MfaDeviceType.BACKUP_CODES,
      name: '备份代码',
      status: MfaDeviceStatus.ACTIVE,
    });

    device.setBackupCodes(codes);
    await this.mfaDeviceRepository.save(device);
  }

  /**
   * 加密秘钥
   */
  private encryptSecret(secret: string): string {
    const key = this.configService.get('MFA_ENCRYPTION_KEY') || 'default-key-change-in-production';
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密秘钥
   */
  private decryptSecret(encryptedSecret: string): string {
    const key = this.configService.get('MFA_ENCRYPTION_KEY') || 'default-key-change-in-production';
    const algorithm = 'aes-256-cbc';
    
    const parts = encryptedSecret.split(':');
    if (parts.length !== 2) {
      throw new Error('无效的加密数据格式');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
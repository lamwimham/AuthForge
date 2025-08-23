import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MfaDeviceType } from '../../database/entities/mfa-device.entity';

export class SetupTotpDto {
  @ApiProperty({ 
    description: '设备名称',
    example: '我的手机'
  })
  @IsString({ message: '设备名称必须为字符串' })
  @IsNotEmpty({ message: '设备名称不能为空' })
  @MaxLength(50, { message: '设备名称不能超过50个字符' })
  deviceName: string;
}

export class SetupSmsDto {
  @ApiProperty({ 
    description: '手机号',
    example: '+8613800138000'
  })
  @IsString({ message: '手机号必须为字符串' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @Matches(/^\\+?[1-9]\\d{1,14}$/, { message: '手机号格式不正确' })
  phoneNumber: string;

  @ApiProperty({ 
    description: '设备名称',
    example: '我的手机短信'
  })
  @IsString({ message: '设备名称必须为字符串' })
  @IsNotEmpty({ message: '设备名称不能为空' })
  @MaxLength(50, { message: '设备名称不能超过50个字符' })
  deviceName: string;
}

export class SetupEmailDto {
  @ApiProperty({ 
    description: '邮箱地址',
    example: 'user@example.com'
  })
  @IsString({ message: '邮箱必须为字符串' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @Matches(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, { message: '邮箱格式不正确' })
  email: string;

  @ApiProperty({ 
    description: '设备名称',
    example: '我的邮箱'
  })
  @IsString({ message: '设备名称必须为字符串' })
  @IsNotEmpty({ message: '设备名称不能为空' })
  @MaxLength(50, { message: '设备名称不能超过50个字符' })
  deviceName: string;
}

export class VerifyMfaSetupDto {
  @ApiProperty({ 
    description: 'MFA设备ID',
    example: 'uuid-string'
  })
  @IsString({ message: 'MFA设备ID必须为字符串' })
  @IsNotEmpty({ message: 'MFA设备ID不能为空' })
  @IsUUID(4, { message: 'MFA设备ID格式不正确' })
  deviceId: string;

  @ApiProperty({ 
    description: '验证码',
    example: '123456'
  })
  @IsString({ message: '验证码必须为字符串' })
  @MinLength(6, { message: '验证码长度为6位' })
  @MaxLength(8, { message: '验证码长度不能超过8位' })
  code: string;
}

export class VerifyMfaCodeDto {
  @ApiProperty({ 
    description: 'MFA验证码',
    example: '123456'
  })
  @IsString({ message: 'MFA验证码必须为字符串' })
  @MinLength(6, { message: 'MFA验证码长度为6位' })
  @MaxLength(8, { message: 'MFA验证码长度不能超过8位' })
  code: string;
}

export class SendMfaCodeDto {
  @ApiProperty({ 
    description: 'MFA设备ID',
    example: 'uuid-string'
  })
  @IsString({ message: 'MFA设备ID必须为字符串' })
  @IsNotEmpty({ message: 'MFA设备ID不能为空' })
  @IsUUID(4, { message: 'MFA设备ID格式不正确' })
  deviceId: string;
}

export class DisableMfaDeviceDto {
  @ApiProperty({ 
    description: 'MFA设备ID',
    example: 'uuid-string'
  })
  @IsString({ message: 'MFA设备ID必须为字符串' })
  @IsNotEmpty({ message: 'MFA设备ID不能为空' })
  @IsUUID(4, { message: 'MFA设备ID格式不正确' })
  deviceId: string;
}

// 响应DTOs
export class MfaSetupResponseDto {
  @ApiProperty({ description: 'TOTP密钥' })
  secret?: string;

  @ApiProperty({ description: '二维码URL' })
  qrCodeUrl?: string;

  @ApiProperty({ description: '备份代码列表' })
  backupCodes?: string[];
}

export class MfaDeviceResponseDto {
  @ApiProperty({ description: '设备ID' })
  id: string;

  @ApiProperty({ description: '设备类型' })
  type: MfaDeviceType;

  @ApiProperty({ description: '设备名称' })
  name: string;

  @ApiProperty({ description: '设备状态' })
  status: string;

  @ApiProperty({ description: '目标（手机号或邮箱）' })
  target?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '最后使用时间' })
  lastUsedAt?: Date;

  @ApiProperty({ description: '使用次数' })
  usageCount: number;
}

export class MfaVerificationResponseDto {
  @ApiProperty({ description: '验证是否成功' })
  success: boolean;

  @ApiProperty({ description: '是否使用了备份代码' })
  backupCodeUsed?: boolean;

  @ApiProperty({ description: '使用的设备信息' })
  deviceUsed?: {
    id: string;
    type: string;
    name: string;
  };
}
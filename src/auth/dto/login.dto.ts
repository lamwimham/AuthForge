import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: '登录标识符（邮箱、手机号或用户名）',
    example: 'user@example.com'
  })
  @IsString({ message: '登录标识符必须为字符串' })
  @IsNotEmpty({ message: '登录标识符不能为空' })
  identifier: string;

  @ApiProperty({ 
    description: '密码',
    example: 'StrongPassword123!'
  })
  @IsString({ message: '密码必须为字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;

  @ApiPropertyOptional({ 
    description: 'MFA验证码',
    example: '123456'
  })
  @IsOptional()
  @IsString({ message: 'MFA验证码必须为字符串' })
  @MinLength(6, { message: 'MFA验证码长度为6位' })
  @MaxLength(6, { message: 'MFA验证码长度为6位' })
  mfaCode?: string;

  @ApiPropertyOptional({ 
    description: '设备信息',
    example: 'Chrome 120.0 on Windows 11'
  })
  @IsOptional()
  @IsString({ message: '设备信息必须为字符串' })
  @MaxLength(255, { message: '设备信息最多255个字符' })
  deviceInfo?: string;
}
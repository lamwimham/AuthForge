import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiPropertyOptional({ 
    description: '邮箱地址',
    example: 'user@example.com'
  })
  @IsOptional()
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email?: string;

  @ApiPropertyOptional({ 
    description: '手机号码',
    example: '+8613800138000'
  })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '请输入有效的手机号码' })
  phone?: string;

  @ApiPropertyOptional({ 
    description: '用户名',
    example: 'johndoe'
  })
  @IsOptional()
  @IsString({ message: '用户名必须为字符串' })
  @MinLength(3, { message: '用户名至少3个字符' })
  @MaxLength(20, { message: '用户名最多20个字符' })
  @Matches(/^[a-zA-Z0-9_]+$/, { 
    message: '用户名只能包含字母、数字和下划线' 
  })
  username?: string;

  @ApiProperty({ 
    description: '密码',
    example: 'StrongPassword123!'
  })
  @IsString({ message: '密码必须为字符串' })
  @MinLength(8, { message: '密码至少8个字符' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '密码必须包含大小写字母、数字和特殊字符(@$!%*?&)'
  })
  password: string;

  @ApiProperty({ 
    description: '确认密码',
    example: 'StrongPassword123!'
  })
  @IsString({ message: '确认密码必须为字符串' })
  confirmPassword: string;

  @ApiPropertyOptional({ 
    description: '验证码',
    example: '123456'
  })
  @IsOptional()
  @IsString({ message: '验证码必须为字符串' })
  @MinLength(6, { message: '验证码长度为6位' })
  @MaxLength(6, { message: '验证码长度为6位' })
  verificationCode?: string;

  // 自定义验证：确保密码匹配
  @ValidateIf(o => o.password !== o.confirmPassword)
  @IsString({ message: '密码确认不匹配' })
  @Matches(/^$/, { message: '密码确认不匹配' })
  passwordMatch?: string;

  // 自定义验证：至少提供一种联系方式
  @ValidateIf(o => !o.email && !o.phone && !o.username)
  @IsString({ message: '必须提供邮箱、手机号或用户名中的至少一种' })
  @Matches(/^$/, { message: '必须提供邮箱、手机号或用户名中的至少一种' })
  contactRequired?: string;
}
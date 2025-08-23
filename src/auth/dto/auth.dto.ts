import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: '刷新令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: '刷新令牌必须为字符串' })
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({
    description: '刷新令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: '刷新令牌必须为字符串' })
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  refreshToken: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: '登录标识符（邮箱、手机号或用户名）',
    example: 'user@example.com',
  })
  @IsString({ message: '登录标识符必须为字符串' })
  @IsNotEmpty({ message: '登录标识符不能为空' })
  identifier: string;

  @ApiProperty({
    description: '验证码',
    example: '123456',
  })
  @IsString({ message: '验证码必须为字符串' })
  @MinLength(6, { message: '验证码长度为6位' })
  @MaxLength(6, { message: '验证码长度为6位' })
  verificationCode: string;

  @ApiProperty({
    description: '新密码',
    example: 'NewStrongPassword123!',
  })
  @IsString({ message: '新密码必须为字符串' })
  @MinLength(8, { message: '新密码至少8个字符' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '新密码必须包含大小写字母、数字和特殊字符(@$!%*?&)',
  })
  newPassword: string;

  @ApiProperty({
    description: '确认新密码',
    example: 'NewStrongPassword123!',
  })
  @IsString({ message: '确认新密码必须为字符串' })
  confirmPassword: string;

  // 自定义验证：确保密码匹配
  @ValidateIf((o: ResetPasswordDto) => o.newPassword !== o.confirmPassword)
  @IsString({ message: '密码确认不匹配' })
  @Matches(/^$/, { message: '密码确认不匹配' })
  passwordMatch?: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: '当前密码',
    example: 'CurrentPassword123!',
  })
  @IsString({ message: '当前密码必须为字符串' })
  @IsNotEmpty({ message: '当前密码不能为空' })
  currentPassword: string;

  @ApiProperty({
    description: '新密码',
    example: 'NewStrongPassword123!',
  })
  @IsString({ message: '新密码必须为字符串' })
  @MinLength(8, { message: '新密码至少8个字符' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '新密码必须包含大小写字母、数字和特殊字符(@$!%*?&)',
  })
  newPassword: string;

  @ApiProperty({
    description: '确认新密码',
    example: 'NewStrongPassword123!',
  })
  @IsString({ message: '确认新密码必须为字符串' })
  confirmPassword: string;

  // 自定义验证：确保密码匹配
  @ValidateIf((o: ChangePasswordDto) => o.newPassword !== o.confirmPassword)
  @IsString({ message: '密码确认不匹配' })
  @Matches(/^$/, { message: '密码确认不匹配' })
  passwordMatch?: string;
}

export class SendVerificationCodeDto {
  @ApiProperty({
    description: '目标（邮箱或手机号）',
    example: 'user@example.com',
  })
  @IsString({ message: '目标必须为字符串' })
  @IsNotEmpty({ message: '目标不能为空' })
  target: string;

  @ApiProperty({
    description: '验证码类型',
    enum: ['register', 'reset_password', 'email_verify', 'phone_verify'],
    example: 'email_verify',
  })
  @IsString({ message: '验证码类型必须为字符串' })
  @IsNotEmpty({ message: '验证码类型不能为空' })
  type: 'register' | 'reset_password' | 'email_verify' | 'phone_verify';
}

export class VerifyCodeDto {
  @ApiProperty({
    description: '验证码',
    example: '123456',
  })
  @IsString({ message: '验证码必须为字符串' })
  @MinLength(6, { message: '验证码长度为6位' })
  @MaxLength(6, { message: '验证码长度为6位' })
  verificationCode: string;
}

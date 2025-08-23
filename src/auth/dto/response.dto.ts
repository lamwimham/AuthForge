import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../database/entities/user.entity';

export class UserProfileDto {
  @ApiProperty({ 
    description: '用户ID',
    example: 'uuid-string'
  })
  id: string;

  @ApiPropertyOptional({ 
    description: '邮箱地址',
    example: 'user@example.com'
  })
  email?: string;

  @ApiPropertyOptional({ 
    description: '手机号码',
    example: '+8613800138000'
  })
  phone?: string;

  @ApiPropertyOptional({ 
    description: '用户名',
    example: 'johndoe'
  })
  username?: string;

  @ApiProperty({ 
    description: '邮箱是否已验证',
    example: true
  })
  emailVerified: boolean;

  @ApiProperty({ 
    description: '手机号是否已验证',
    example: false
  })
  phoneVerified: boolean;

  @ApiProperty({ 
    description: '是否启用MFA',
    example: false
  })
  mfaEnabled: boolean;

  @ApiProperty({ 
    description: '用户状态',
    enum: UserStatus,
    example: UserStatus.ACTIVE
  })
  status: UserStatus;

  @ApiPropertyOptional({ 
    description: '最后登录时间',
    example: '2023-12-01T10:00:00Z'
  })
  lastLoginAt?: Date;

  @ApiProperty({ 
    description: '创建时间',
    example: '2023-11-01T10:00:00Z'
  })
  createdAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({ 
    description: '访问令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({ 
    description: '刷新令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refreshToken: string;

  @ApiProperty({ 
    description: '访问令牌过期时间（秒）',
    example: 900
  })
  expiresIn: number;

  @ApiProperty({ 
    description: '用户信息',
    type: UserProfileDto
  })
  user: UserProfileDto;

  @ApiPropertyOptional({ 
    description: '是否需要MFA验证',
    example: false
  })
  mfaRequired?: boolean;
}

export class ApiResponseDto<T = any> {
  @ApiProperty({ 
    description: '操作是否成功',
    example: true
  })
  success: boolean;

  @ApiProperty({ 
    description: '响应消息',
    example: '操作成功'
  })
  message: string;

  @ApiPropertyOptional({ 
    description: '响应数据'
  })
  data?: T;

  @ApiPropertyOptional({ 
    description: '错误信息'
  })
  errors?: any;

  @ApiPropertyOptional({ 
    description: '响应时间戳',
    example: '2023-12-01T10:00:00Z'
  })
  timestamp?: string;

  @ApiPropertyOptional({ 
    description: '请求路径',
    example: '/api/v1/auth/login'
  })
  path?: string;
}

export class TokenResponseDto {
  @ApiProperty({ 
    description: '访问令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({ 
    description: '刷新令牌',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refreshToken: string;

  @ApiProperty({ 
    description: '访问令牌过期时间（秒）',
    example: 900
  })
  expiresIn: number;
}

export class MessageResponseDto {
  @ApiProperty({ 
    description: '响应消息',
    example: '操作成功'
  })
  message: string;
}
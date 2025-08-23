import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { User, Gender } from '../../database/entities/user.entity';

export class UserBasicInfoDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiPropertyOptional({ description: '用户名' })
  username?: string;

  @ApiPropertyOptional({ description: '名字' })
  firstName?: string;

  @ApiPropertyOptional({ description: '姓氏' })
  lastName?: string;

  @ApiPropertyOptional({ description: '头像URL' })
  avatar?: string;

  @ApiProperty({ description: '显示名称' })
  @Expose()
  get displayName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ') ||
           this.username ||
           'User';
  }

  @ApiProperty({ description: '完整姓名' })
  @Expose()
  get fullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }

  constructor(user: Partial<User>) {
    this.id = user.id || '';
    this.username = user.username;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.avatar = user.avatar;
  }
}

export class UserProfileResponseDto extends UserBasicInfoDto {
  @ApiPropertyOptional({ description: '邮箱地址' })
  email?: string;

  @ApiPropertyOptional({ description: '手机号码' })
  phone?: string;

  @ApiPropertyOptional({ description: '个人简介' })
  bio?: string;

  @ApiPropertyOptional({ description: '生日' })
  birthday?: Date;

  @ApiPropertyOptional({ description: '性别', enum: Gender })
  gender?: Gender;

  @ApiProperty({ description: '邮箱是否已验证' })
  emailVerified: boolean;

  @ApiProperty({ description: '手机是否已验证' })
  phoneVerified: boolean;

  @ApiProperty({ description: '个人信息是否完整' })
  @Expose()
  get profileComplete(): boolean {
    return !!(this.firstName && this.lastName);
  }

  @ApiProperty({ description: '是否有头像' })
  @Expose()
  get hasAvatar(): boolean {
    return !!this.avatar;
  }

  @ApiPropertyOptional({ description: '年龄' })
  @Expose()
  get age(): number | null {
    if (!this.birthday) return null;
    
    const today = new Date();
    const birthDate = new Date(this.birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  @ApiProperty({ description: '账号创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '最后更新时间' })
  updatedAt: Date;

  constructor(user: User) {
    super(user);
    this.email = user.email;
    this.phone = user.phone;
    this.bio = user.bio;
    this.birthday = user.birthday;
    this.gender = user.gender;
    this.emailVerified = user.emailVerified;
    this.phoneVerified = user.phoneVerified;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}

export class ApiResponseDto<T = any> {
  @ApiProperty({ description: '操作是否成功' })
  success: boolean;

  @ApiProperty({ description: '响应消息' })
  message: string;

  @ApiPropertyOptional({ description: '响应数据' })
  data?: T;

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string;

  constructor(success: boolean, message: string, data?: T, error?: string) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
  }

  static success<T>(data: T, message = '操作成功'): ApiResponseDto<T> {
    return new ApiResponseDto(true, message, data);
  }

  static error(message: string, error?: string): ApiResponseDto {
    return new ApiResponseDto(false, message, undefined, error);
  }
}
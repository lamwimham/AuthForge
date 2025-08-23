import { 
  Injectable, 
  UnauthorizedException, 
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { TokenService, AuthTokens } from './token.service';
import { PasswordService } from './password.service';
import { VerificationCodeService } from './verification-code.service';
import { User, UserStatus } from '../../database/entities/user.entity';

export interface RegisterDto {
  email?: string;
  phone?: string;
  username?: string;
  password: string;
  confirmPassword: string;
  verificationCode?: string;
}

export interface LoginDto {
  identifier: string; // 邮箱、手机号或用户名
  password: string;
  mfaCode?: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email?: string;
    phone?: string;
    username?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    mfaEnabled: boolean;
    status: UserStatus;
    lastLoginAt?: Date;
    createdAt: Date;
  };
  mfaRequired?: boolean;
}

export interface ResetPasswordDto {
  identifier: string;
  verificationCode: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private tokenService: TokenService,
    private passwordService: PasswordService,
    private verificationCodeService: VerificationCodeService,
  ) {}

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<User> {
    const { email, phone, username, password, confirmPassword } = registerDto;

    // 验证密码确认
    if (password !== confirmPassword) {
      throw new BadRequestException('密码确认不匹配');
    }

    // 检查至少提供了一种联系方式
    if (!email && !phone && !username) {
      throw new BadRequestException('必须提供邮箱、手机号或用户名中的至少一种');
    }

    try {
      const user = await this.userService.createUser({
        email,
        phone,
        username,
        password,
      });

      return user;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('已被使用')) {
        throw new ConflictException(errorMessage);
      }
      if (errorMessage.includes('密码强度不足')) {
        throw new BadRequestException(errorMessage);
      }
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { identifier, password, mfaCode, deviceInfo, ipAddress } = loginDto;

    // 查找用户
    const user = await this.userService.findByIdentifierWithPassword(identifier);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查账户状态
    this.checkUserStatus(user);

    // 验证密码
    const isPasswordValid = await this.userService.validatePassword(user, password);
    if (!isPasswordValid) {
      await this.userService.recordLoginFailure(user);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查是否需要MFA
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return {
          mfaRequired: true,
        } as AuthResponse;
      }

      // 验证MFA代码（这里暂时简化处理，实际需要验证TOTP）
      // const isMfaValid = await this.verifyMfaCode(user, mfaCode);
      // if (!isMfaValid) {
      //   throw new UnauthorizedException('MFA验证失败');
      // }
    }

    // 记录成功登录
    await this.userService.recordLoginSuccess(user);

    // 生成令牌
    const tokens = await this.tokenService.generateAuthTokens(user, deviceInfo, ipAddress);

    return {
      ...tokens,
      user: this.mapToUserProfile(user),
    };
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const tokens = await this.tokenService.refreshAccessToken(refreshToken);
    if (!tokens) {
      throw new UnauthorizedException('无效的刷新令牌');
    }

    return tokens;
  }

  /**
   * 用户登出
   */
  async logout(refreshToken: string, accessToken?: string): Promise<void> {
    // 吊销刷新令牌
    const tokenRecord = await this.tokenService.verifyRefreshToken(refreshToken);
    if (tokenRecord) {
      await this.tokenService.revokeRefreshToken(tokenRecord.id);
    }

    // 将访问令牌加入黑名单
    if (accessToken) {
      await this.tokenService.blacklistAccessToken(accessToken);
    }
  }

  /**
   * 登出所有设备
   */
  async logoutAll(userId: string, currentAccessToken?: string): Promise<void> {
    // 吊销所有刷新令牌
    await this.tokenService.revokeAllUserTokens(userId);

    // 将当前访问令牌加入黑名单
    if (currentAccessToken) {
      await this.tokenService.blacklistAccessToken(currentAccessToken);
    }
  }

  /**
   * 重置密码
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { identifier, verificationCode: _verificationCode, newPassword, confirmPassword } = resetPasswordDto;

    // 忽略暂时未使用的验证码参数
    void _verificationCode;

    // 验证密码确认
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('密码确认不匹配');
    }

    // 验证验证码
    const isCodeValid = await this.verificationCodeService.verifyCode(
      identifier,
      'reset_password',
      _verificationCode,
    );
    if (!isCodeValid) {
      throw new UnauthorizedException('验证码无效或已过期');
    }

    // 查找用户
    const user = await this.userService.findByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 更新密码
    await this.userService.updatePassword(user.id, newPassword);

    // 吊销所有现有令牌
    await this.tokenService.revokeAllUserTokens(user.id);
  }

  /**
   * 修改密码
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    // 验证密码确认
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('密码确认不匹配');
    }

    // 查找用户
    const user = await this.userService.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 验证当前密码
    const isCurrentPasswordValid = await this.userService.validatePassword(user, currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('当前密码错误');
    }

    // 更新密码
    await this.userService.updatePassword(userId, newPassword);

    // 吊销所有其他设备的令牌
    await this.tokenService.revokeAllUserTokens(userId);
  }

  /**
   * 验证访问令牌
   */
  async validateAccessToken(token: string): Promise<User | null> {
    const payload = await this.tokenService.verifyAccessToken(token);
    if (!payload) {
      return null;
    }

    const user = await this.userService.findById(payload.sub);
    if (!user || !user.isActive()) {
      return null;
    }

    return user;
  }

  /**
   * 获取用户资料
   */
  async getUserProfile(userId: string): Promise<any> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return this.mapToUserProfile(user);
  }

  /**
   * 激活用户账户
   */
  async activateUser(userId: string): Promise<void> {
    await this.userService.activateUser(userId);
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(userId: string, _verificationCode: string): Promise<void> {
    // 忽略暂时未使用的验证码参数
    void _verificationCode;

    // 获取用户信息
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (!user.email) {
      throw new BadRequestException('用户没有设置邮箱');
    }

    // 验证验证码
    const isCodeValid = await this.verificationCodeService.verifyCode(
      user.email,
      'email_verify',
      _verificationCode,
      userId,
    );
    if (!isCodeValid) {
      throw new UnauthorizedException('验证码无效或已过期');
    }

    await this.userService.verifyEmail(userId);
  }

  /**
   * 验证手机号
   */
  async verifyPhone(userId: string, _verificationCode: string): Promise<void> {
    // 忽略暂时未使用的验证码参数
    void _verificationCode;

    // 获取用户信息
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (!user.phone) {
      throw new BadRequestException('用户没有设置手机号');
    }

    // 验证验证码
    const isCodeValid = await this.verificationCodeService.verifyCode(
      user.phone,
      'phone_verify',
      _verificationCode,
      userId,
    );
    if (!isCodeValid) {
      throw new UnauthorizedException('验证码无效或已过期');
    }

    await this.userService.verifyPhone(userId);
  }

  /**
   * 检查用户状态
   */
  private checkUserStatus(user: User): void {
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('账户已被禁用');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('账户尚未激活，请先验证邮箱或手机号');
    }

    if (user.isLocked()) {
      if (user.status === UserStatus.LOCKED) {
        throw new UnauthorizedException('账户已被锁定，请联系管理员');
      } else {
        const lockTimeMinutes = user.lockedUntil 
          ? Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60))
          : 0;
        throw new HttpException(
          `由于多次登录失败，账户已被锁定 ${lockTimeMinutes} 分钟`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
  }

  /**
   * 映射用户信息到返回格式
   */
  private mapToUserProfile(user: User): AuthResponse['user'] {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      username: user.username,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      mfaEnabled: user.mfaEnabled,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
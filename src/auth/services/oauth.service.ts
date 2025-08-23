import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../database/entities/user.entity';
import { OAuthProvider, OAuthProviderType } from '../../database/entities/oauth-provider.entity';
import { TokenService } from './token.service';
import { UserService } from './user.service';

export interface OAuthUserData {
  provider: string;
  providerId: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  accessToken: string;
  refreshToken?: string;
}

export interface OAuthLoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser: boolean;
}

@Injectable()
export class OAuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OAuthProvider)
    private oauthProviderRepository: Repository<OAuthProvider>,
    private tokenService: TokenService,
    private userService: UserService,
  ) {}

  /**
   * 验证OAuth用户并返回登录结果
   */
  async validateOAuthUser(oauthData: OAuthUserData): Promise<OAuthLoginResult> {
    // 检查是否已存在OAuth提供商记录
    let oauthProvider = await this.oauthProviderRepository.findOne({
      where: {
        provider: oauthData.provider as OAuthProviderType,
        providerUserId: oauthData.providerId,
      },
      relations: ['user'],
    });

    let user: User | null = null;
    let isNewUser = false;

    if (oauthProvider) {
      // 已存在OAuth记录，更新token
      user = oauthProvider.user;
      await this.updateOAuthTokens(oauthProvider, oauthData);
    } else {
      // 新的OAuth登录，检查是否有相同邮箱的用户
      if (oauthData.email) {
        user = await this.userRepository.findOne({
          where: { email: oauthData.email },
        });
      }

      if (user) {
        // 绑定到现有用户
        await this.linkOAuthProvider(user.id, oauthData);
      } else {
        // 创建新用户
        user = await this.createUserFromOAuth(oauthData);
        isNewUser = true;
      }
    }

    if (!user) {
      throw new BadRequestException('用户创建或获取失败');
    }

    // 生成JWT令牌
    const tokens = await this.tokenService.generateAuthTokens(user);

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      isNewUser,
    };
  }

  /**
   * 绑定OAuth提供商到现有用户
   */
  async linkOAuthProvider(
    userId: string,
    oauthData: OAuthUserData,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 检查是否已绑定同类型提供商
    const existingProvider = await this.oauthProviderRepository.findOne({
      where: {
        userId: user.id,
        provider: oauthData.provider as OAuthProviderType,
      },
    });

    if (existingProvider) {
      throw new ConflictException('已绑定该类型的OAuth提供商');
    }

    // 检查该OAuth账户是否已被其他用户绑定
    const existingOAuth = await this.oauthProviderRepository.findOne({
      where: {
        provider: oauthData.provider as OAuthProviderType,
        providerUserId: oauthData.providerId,
      },
    });

    if (existingOAuth) {
      throw new ConflictException('该OAuth账户已被其他用户绑定');
    }

    await this.createOAuthProvider(user, oauthData);
  }

  /**
   * 解绑OAuth提供商
   */
  async unlinkOAuthProvider(
    userId: string,
    provider: OAuthProviderType,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['oauthProviders'],
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 检查用户是否有密码，如果没有密码且只有一个OAuth提供商，不允许解绑
    if (!user.passwordHash && user.oauthProviders.length <= 1) {
      throw new BadRequestException('无法解绑最后一个登录方式，请先设置密码');
    }

    const oauthProvider = await this.oauthProviderRepository.findOne({
      where: { userId, provider },
    });

    if (!oauthProvider) {
      throw new BadRequestException('OAuth提供商绑定不存在');
    }

    await this.oauthProviderRepository.remove(oauthProvider);
  }

  /**
   * 获取用户绑定的OAuth提供商列表
   */
  async getUserOAuthProviders(userId: string): Promise<OAuthProvider[]> {
    return this.oauthProviderRepository.find({
      where: { userId },
      select: ['id', 'provider', 'createdAt', 'updatedAt'],
    });
  }

  /**
   * 从OAuth数据创建新用户
   */
  private async createUserFromOAuth(oauthData: OAuthUserData): Promise<User> {
    const userData = {
      email: oauthData.email,
      username: await this.generateUniqueUsername(oauthData),
      emailVerified: !!oauthData.email, // OAuth邮箱默认已验证
      status: UserStatus.ACTIVE,
    };

    const user = await this.userService.createOAuthUser(userData);
    await this.createOAuthProvider(user, oauthData);

    return user;
  }

  /**
   * 创建OAuth提供商记录
   */
  private async createOAuthProvider(
    user: User,
    oauthData: OAuthUserData,
  ): Promise<OAuthProvider> {
    const oauthProvider = this.oauthProviderRepository.create({
      userId: user.id,
      provider: oauthData.provider as OAuthProviderType,
      providerUserId: oauthData.providerId,
      accessToken: oauthData.accessToken,
      refreshToken: oauthData.refreshToken,
      expiresAt: this.calculateTokenExpiry(),
    });

    return this.oauthProviderRepository.save(oauthProvider);
  }

  /**
   * 更新OAuth令牌
   */
  private async updateOAuthTokens(
    oauthProvider: OAuthProvider,
    oauthData: OAuthUserData,
  ): Promise<void> {
    oauthProvider.updateTokens(
      oauthData.accessToken,
      oauthData.refreshToken,
    );
    oauthProvider.expiresAt = this.calculateTokenExpiry();
    await this.oauthProviderRepository.save(oauthProvider);
  }

  /**
   * 生成唯一用户名
   */
  private async generateUniqueUsername(oauthData: OAuthUserData): Promise<string> {
    let baseUsername = 
      oauthData.username || 
      oauthData.displayName?.replace(/\s+/g, '') || 
      oauthData.email?.split('@')[0] || 
      `${oauthData.provider}user`;

    // 清理用户名，只保留字母数字和下划线
    baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    let username = baseUsername;
    let counter = 1;

    // 检查用户名是否已存在，如果存在则添加数字后缀
    while (await this.userRepository.findOne({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  /**
   * 计算令牌过期时间（默认1小时）
   */
  private calculateTokenExpiry(): Date {
    return new Date(Date.now() + 60 * 60 * 1000);
  }
}
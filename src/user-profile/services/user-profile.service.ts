import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { CacheService } from '../../common/services/cache.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {
  UserProfileResponseDto,
  UserBasicInfoDto,
} from '../dto/profile-response.dto';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 获取用户完整信息
   */
  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    this.logger.log(`获取用户信息: ${userId}`);

    // 尝试从缓存获取
    const cacheKey = this.cacheService.getUserProfileKey(userId);
    const cachedProfile = await this.cacheService.get<UserProfileResponseDto>(cacheKey);
    
    if (cachedProfile) {
      this.logger.debug(`从缓存获取用户信息: ${userId}`);
      return cachedProfile;
    }

    // 从数据库查询
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const profile = new UserProfileResponseDto(user);
    
    // 设置缓存，30分钟过期
    await this.cacheService.set(cacheKey, profile, { ttl: 1800 });
    
    return profile;
  }

  /**
   * 获取用户基础信息
   */
  async getBasicInfo(userId: string): Promise<UserBasicInfoDto> {
    this.logger.log(`获取用户基础信息: ${userId}`);

    // 尝试从缓存获取
    const cacheKey = this.cacheService.getUserBasicInfoKey(userId);
    const cachedBasicInfo = await this.cacheService.get<UserBasicInfoDto>(cacheKey);
    
    if (cachedBasicInfo) {
      this.logger.debug(`从缓存获取用户基础信息: ${userId}`);
      return cachedBasicInfo;
    }

    // 从数据库查询
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'username', 'firstName', 'lastName', 'avatar'],
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const basicInfo = new UserBasicInfoDto(user);
    
    // 设置缓存，1小时过期
    await this.cacheService.set(cacheKey, basicInfo, { ttl: 3600 });
    
    return basicInfo;
  }

  /**
   * 更新用户信息
   */
  async updateProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    this.logger.log(`更新用户信息: ${userId}`, updateDto);

    // 查找用户
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证并清理数据
    await this.validateProfileData(updateDto);

    // 更新用户信息
    Object.assign(user, updateDto);

    try {
      const updatedUser = await this.userRepository.save(user);
      
      // 清除用户相关缓存
      await this.cacheService.clearUserCache(userId);
      
      this.logger.log(`用户信息更新成功: ${userId}`);
      
      return new UserProfileResponseDto(updatedUser);
    } catch (error) {
      this.logger.error(`用户信息更新失败: ${userId}`, error);
      throw new BadRequestException('用户信息更新失败');
    }
  }

  /**
   * 更新用户头像
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    this.logger.log(`更新用户头像: ${userId} -> ${avatarUrl}`);

    const result = await this.userRepository.update(
      { id: userId },
      { avatar: avatarUrl },
    );

    if (result.affected === 0) {
      throw new NotFoundException('用户不存在');
    }

    this.logger.log(`用户头像更新成功: ${userId}`);
  }

  /**
   * 删除用户头像
   */
  async removeAvatar(userId: string): Promise<void> {
    this.logger.log(`删除用户头像: ${userId}`);

    const result = await this.userRepository.update(
      { id: userId },
      { avatar: undefined },
    );

    if (result.affected === 0) {
      throw new NotFoundException('用户不存在');
    }

    this.logger.log(`用户头像删除成功: ${userId}`);
  }

  /**
   * 检查用户是否存在
   */
  async userExists(userId: string): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { id: userId },
    });
    return count > 0;
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(userId: string): Promise<{
    profileCompletionRate: number;
    hasAvatar: boolean;
    hasBasicInfo: boolean;
    hasContactInfo: boolean;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const hasBasicInfo = !!(user.firstName && user.lastName);
    const hasContactInfo = !!(user.email || user.phone);
    const hasAvatar = !!user.avatar;
    const hasBio = !!user.bio;
    const hasBirthday = !!user.birthday;
    const hasGender = !!user.gender;

    // 计算完成度
    const totalFields = 6; // firstName, lastName, avatar, bio, birthday, gender
    let completedFields = 0;

    if (hasBasicInfo) completedFields += 2; // firstName + lastName
    if (hasAvatar) completedFields += 1;
    if (hasBio) completedFields += 1;
    if (hasBirthday) completedFields += 1;
    if (hasGender) completedFields += 1;

    const profileCompletionRate = Math.round((completedFields / totalFields) * 100);

    return {
      profileCompletionRate,
      hasAvatar,
      hasBasicInfo,
      hasContactInfo,
    };
  }

  /**
   * 验证用户信息数据
   */
  private async validateProfileData(data: UpdateProfileDto): Promise<void> {
    // 验证生日不能是未来日期
    if (data.birthday && data.birthday > new Date()) {
      throw new BadRequestException('生日不能是未来日期');
    }

    // 验证年龄合理性（如果提供了生日）
    if (data.birthday) {
      const age = this.calculateAge(data.birthday);
      if (age < 13 || age > 120) {
        throw new BadRequestException('年龄必须在13-120岁之间');
      }
    }

    // 清理和验证文本字段
    if (data.firstName) {
      data.firstName = this.sanitizeText(data.firstName);
    }
    if (data.lastName) {
      data.lastName = this.sanitizeText(data.lastName);
    }
    if (data.bio) {
      data.bio = this.sanitizeText(data.bio);
    }
  }

  /**
   * 计算年龄
   */
  private calculateAge(birthday: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const monthDiff = today.getMonth() - birthday.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * 清理文本数据，防止XSS
   */
  private sanitizeText(text: string): string {
    return text
      .trim()
      .replace(/[<>\"'&]/g, '') // 移除可能的HTML字符
      .replace(/\s+/g, ' '); // 规范化空格
  }
}
import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Query,
  UseGuards,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { UserProfileService } from '../services/user-profile.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {
  UserProfileResponseDto,
  UserBasicInfoDto,
  ApiResponseDto,
} from '../dto/profile-response.dto';

@ApiTags('用户信息管理')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  private readonly logger = new Logger(UserProfileController.name);

  constructor(private readonly userProfileService: UserProfileService) {}

  @Get('profile')
  @ApiOperation({ summary: '获取用户信息' })
  @ApiQuery({
    name: 'level',
    required: false,
    description: '信息级别',
    enum: ['basic', 'full'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取用户信息成功',
    type: UserProfileResponseDto,
  })
  async getProfile(
    @CurrentUser() user: User,
    @Query('level') level: 'basic' | 'full' = 'full',
  ): Promise<ApiResponseDto<UserProfileResponseDto | UserBasicInfoDto>> {
    this.logger.log(`获取用户信息: ${user.id}, level: ${level}`);

    try {
      if (level === 'basic') {
        const basicInfo = await this.userProfileService.getBasicInfo(user.id);
        return ApiResponseDto.success(basicInfo, '获取基础信息成功');
      }

      const profile = await this.userProfileService.getProfile(user.id);
      return ApiResponseDto.success(profile, '获取用户信息成功');
    } catch (error) {
      this.logger.error(`获取用户信息失败: ${user.id}`, error);
      throw error;
    }
  }

  @Put('profile')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '更新用户信息成功',
    type: UserProfileResponseDto,
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateDto: UpdateProfileDto,
  ): Promise<ApiResponseDto<UserProfileResponseDto>> {
    this.logger.log(`更新用户信息: ${user.id}`, updateDto);

    try {
      const updatedProfile = await this.userProfileService.updateProfile(
        user.id,
        updateDto,
      );

      return ApiResponseDto.success(updatedProfile, '用户信息更新成功');
    } catch (error) {
      this.logger.error(`更新用户信息失败: ${user.id}`, error);
      throw error;
    }
  }

  @Delete('avatar')
  @ApiOperation({ summary: '删除用户头像' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '删除头像成功',
  })
  async removeAvatar(
    @CurrentUser() user: User,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`删除用户头像: ${user.id}`);

    try {
      await this.userProfileService.removeAvatar(user.id);
      return ApiResponseDto.success(null, '头像删除成功');
    } catch (error) {
      this.logger.error(`删除头像失败: ${user.id}`, error);
      throw error;
    }
  }

  @Get('stats')
  @ApiOperation({ summary: '获取用户统计信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取用户统计信息成功',
  })
  async getUserStats(
    @CurrentUser() user: User,
  ): Promise<ApiResponseDto<{
    profileCompletionRate: number;
    hasAvatar: boolean;
    hasBasicInfo: boolean;
    hasContactInfo: boolean;
  }>> {
    this.logger.log(`获取用户统计信息: ${user.id}`);

    try {
      const stats = await this.userProfileService.getUserStats(user.id);
      return ApiResponseDto.success(stats, '获取统计信息成功');
    } catch (error) {
      this.logger.error(`获取用户统计信息失败: ${user.id}`, error);
      throw error;
    }
  }
}
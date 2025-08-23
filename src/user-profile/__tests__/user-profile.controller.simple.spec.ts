import { UserProfileController } from '../controllers/user-profile.controller';
import { UserProfileService } from '../services/user-profile.service';
import { User, Gender, UserStatus } from '../../database/entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserProfileResponseDto, UserBasicInfoDto, ApiResponseDto } from '../dto/profile-response.dto';
import { NotFoundException } from '@nestjs/common';

describe('UserProfileController (Simple)', () => {
  let controller: UserProfileController;
  let userProfileService: jest.Mocked<UserProfileService>;

  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    phone: '+1234567890',
    username: 'testuser',
    passwordHash: 'hashed-password',
    emailVerified: true,
    phoneVerified: false,
    mfaEnabled: false,
    mfaSecret: null,
    status: UserStatus.ACTIVE,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    firstName: 'John',
    lastName: 'Doe',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Software Engineer',
    birthday: new Date('1990-01-15'),
    gender: Gender.MALE,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
    oauthProviders: [],
    mfaDevices: [],
    // Entity methods
    isLocked: jest.fn().mockReturnValue(false),
    isActive: jest.fn().mockReturnValue(true),
    hasVerifiedContact: jest.fn().mockReturnValue(true),
    incrementFailedAttempts: jest.fn(),
    resetFailedAttempts: jest.fn(),
    hasActiveMfaDevices: jest.fn().mockReturnValue(false),
    getActiveMfaDevices: jest.fn().mockReturnValue([]),
    getFullName: jest.fn().mockReturnValue('John Doe'),
    getDisplayName: jest.fn().mockReturnValue('John Doe'),
    isProfileComplete: jest.fn().mockReturnValue(true),
    getAge: jest.fn().mockReturnValue(33),
    hasAvatar: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    const mockService = {
      getProfile: jest.fn(),
      getBasicInfo: jest.fn(),
      updateProfile: jest.fn(),
      updateAvatar: jest.fn(),
      removeAvatar: jest.fn(),
      getUserStats: jest.fn(),
      userExists: jest.fn(),
    } as jest.Mocked<UserProfileService>;

    userProfileService = mockService;
    controller = new UserProfileController(userProfileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('应该返回完整用户信息 (level=full)', async () => {
      const mockResponse = new UserProfileResponseDto(mockUser);
      userProfileService.getProfile.mockResolvedValue(mockResponse);

      const result = await controller.getProfile(mockUser, 'full');

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('获取用户信息成功');
      expect(result.data).toBe(mockResponse);
      expect(userProfileService.getProfile).toHaveBeenCalledWith('test-user-id');
    });

    it('应该返回基础用户信息 (level=basic)', async () => {
      const mockResponse = new UserBasicInfoDto(mockUser);
      userProfileService.getBasicInfo.mockResolvedValue(mockResponse);

      const result = await controller.getProfile(mockUser, 'basic');

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('获取基础信息成功');
      expect(result.data).toBe(mockResponse);
      expect(userProfileService.getBasicInfo).toHaveBeenCalledWith('test-user-id');
    });

    it('应该默认返回完整用户信息', async () => {
      const mockResponse = new UserProfileResponseDto(mockUser);
      userProfileService.getProfile.mockResolvedValue(mockResponse);

      const result = await controller.getProfile(mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe('获取用户信息成功');
      expect(userProfileService.getProfile).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('updateProfile', () => {
    it('应该成功更新用户信息', async () => {
      const updateDto: UpdateProfileDto = {
        firstName: 'Jane',
        lastName: 'Smith',
        bio: 'Updated bio',
      };

      const updatedProfile = new UserProfileResponseDto({
        ...mockUser,
        ...updateDto,
      });

      userProfileService.updateProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('用户信息更新成功');
      expect(result.data).toBe(updatedProfile);
      expect(userProfileService.updateProfile).toHaveBeenCalledWith(
        'test-user-id',
        updateDto
      );
    });
  });

  describe('removeAvatar', () => {
    it('应该成功删除用户头像', async () => {
      userProfileService.removeAvatar.mockResolvedValue(undefined);

      const result = await controller.removeAvatar(mockUser);

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('头像删除成功');
      expect(result.data).toBeNull();
      expect(userProfileService.removeAvatar).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('getUserStats', () => {
    it('应该成功返回用户统计信息', async () => {
      const mockStats = {
        profileCompletionRate: 85,
        hasAvatar: true,
        hasBasicInfo: true,
        hasContactInfo: true,
      };

      userProfileService.getUserStats.mockResolvedValue(mockStats);

      const result = await controller.getUserStats(mockUser);

      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('获取统计信息成功');
      expect(result.data).toBe(mockStats);
      expect(userProfileService.getUserStats).toHaveBeenCalledWith('test-user-id');
    });
  });
});
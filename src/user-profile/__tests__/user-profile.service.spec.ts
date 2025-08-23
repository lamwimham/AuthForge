import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserProfileService } from '../services/user-profile.service';
import { User, Gender, UserStatus } from '../../database/entities/user.entity';
import { CacheService } from '../../common/services/cache.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserProfileResponseDto, UserBasicInfoDto } from '../dto/profile-response.dto';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let userRepository: jest.Mocked<Repository<User>>;
  let cacheService: jest.Mocked<CacheService>;

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

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      clearUserCache: jest.fn(),
      getUserProfileKey: jest.fn(),
      getUserBasicInfoKey: jest.fn(),
      getUserStatsKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    userRepository = module.get(getRepositoryToken(User));
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('应该成功返回用户完整信息', async () => {
      cacheService.getUserProfileKey.mockReturnValue('user:profile:test-user-id');
      cacheService.get.mockResolvedValue(null); // 模拟缓存未命中
      userRepository.findOne.mockResolvedValue(mockUser);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getProfile('test-user-id');

      expect(result).toBeInstanceOf(UserProfileResponseDto);
      expect(result.id).toBe('test-user-id');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'user:profile:test-user-id',
        expect.any(UserProfileResponseDto),
        { ttl: 1800 }
      );
    });

    it('应该从缓存返回用户信息', async () => {
      const cachedProfile = new UserProfileResponseDto(mockUser);
      cacheService.getUserProfileKey.mockReturnValue('user:profile:test-user-id');
      cacheService.get.mockResolvedValue(cachedProfile);

      const result = await service.getProfile('test-user-id');

      expect(result).toBe(cachedProfile);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('当用户不存在时应该抛出NotFoundException', async () => {
      cacheService.getUserProfileKey.mockReturnValue('user:profile:non-existent-id');
      cacheService.get.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('getBasicInfo', () => {
    it('应该成功返回用户基础信息', async () => {
      const basicUser = {
        id: 'test-user-id',
        username: 'testuser',
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
      };
      
      cacheService.getUserBasicInfoKey.mockReturnValue('user:basic:test-user-id');
      cacheService.get.mockResolvedValue(null); // 模拟缓存未命中
      userRepository.findOne.mockResolvedValue(basicUser as User);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getBasicInfo('test-user-id');

      expect(result).toBeInstanceOf(UserBasicInfoDto);
      expect(result.id).toBe('test-user-id');
      expect(result.firstName).toBe('John');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        select: ['id', 'username', 'firstName', 'lastName', 'avatar'],
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'user:basic:test-user-id',
        expect.any(UserBasicInfoDto),
        { ttl: 3600 }
      );
    });

    it('应该从缓存返回基础信息', async () => {
      const cachedBasicInfo = new UserBasicInfoDto(mockUser);
      cacheService.getUserBasicInfoKey.mockReturnValue('user:basic:test-user-id');
      cacheService.get.mockResolvedValue(cachedBasicInfo);

      const result = await service.getBasicInfo('test-user-id');

      expect(result).toBe(cachedBasicInfo);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('当用户不存在时应该抛出NotFoundException', async () => {
      cacheService.getUserBasicInfoKey.mockReturnValue('user:basic:non-existent-id');
      cacheService.get.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getBasicInfo('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('应该成功更新用户信息', async () => {
      const updateDto: UpdateProfileDto = {
        firstName: 'Jane',
        lastName: 'Smith',
        bio: 'Updated bio',
        birthday: new Date('1992-05-20'),
        gender: Gender.FEMALE,
      };

      const updatedUser = { ...mockUser, ...updateDto };
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);
      cacheService.clearUserCache.mockResolvedValue(undefined);

      const result = await service.updateProfile('test-user-id', updateDto);

      expect(result).toBeInstanceOf(UserProfileResponseDto);
      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
      expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining(updateDto));
      expect(cacheService.clearUserCache).toHaveBeenCalledWith('test-user-id');
    });

    it('当用户不存在时应该抛出NotFoundException', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const updateDto: UpdateProfileDto = { firstName: 'Jane' };

      await expect(service.updateProfile('non-existent-id', updateDto))
        .rejects
        .toThrow(NotFoundException);
    });

    it('当生日是未来日期时应该抛出BadRequestException', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const updateDto: UpdateProfileDto = {
        birthday: futureDate,
      };

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.updateProfile('test-user-id', updateDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('当年龄不合理时应该抛出BadRequestException', async () => {
      const tooOldDate = new Date('1900-01-01');
      const updateDto: UpdateProfileDto = {
        birthday: tooOldDate,
      };

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.updateProfile('test-user-id', updateDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('应该清理和验证文本字段', async () => {
      const updateDto: UpdateProfileDto = {
        firstName: '  John  ',
        bio: 'Bio with <script>alert(\"xss\")</script> malicious content',
      };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await service.updateProfile('test-user-id', updateDto);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'John',
          bio: expect.not.stringContaining('<script>'),
        })
      );
    });

    it('当数据库保存失败时应该抛出BadRequestException', async () => {
      const updateDto: UpdateProfileDto = { firstName: 'Jane' };
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.updateProfile('test-user-id', updateDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('updateAvatar', () => {
    it('应该成功更新用户头像', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateAvatar('test-user-id', 'https://newavatar.com/image.jpg');

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'test-user-id' },
        { avatar: 'https://newavatar.com/image.jpg' }
      );
    });

    it('当用户不存在时应该抛出NotFoundException', async () => {
      userRepository.update.mockResolvedValue({ affected: 0 } as any);

      await expect(service.updateAvatar('non-existent-id', 'avatar-url'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('removeAvatar', () => {
    it('应该成功删除用户头像', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.removeAvatar('test-user-id');

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: 'test-user-id' },
        { avatar: undefined }
      );
    });

    it('当用户不存在时应该抛出NotFoundException', async () => {
      userRepository.update.mockResolvedValue({ affected: 0 } as any);

      await expect(service.removeAvatar('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('userExists', () => {
    it('当用户存在时应该返回true', async () => {
      userRepository.count.mockResolvedValue(1);

      const result = await service.userExists('test-user-id');

      expect(result).toBe(true);
      expect(userRepository.count).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
      });
    });

    it('当用户不存在时应该返回false', async () => {
      userRepository.count.mockResolvedValue(0);

      const result = await service.userExists('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('getUserStats', () => {
    it('应该返回正确的用户统计信息', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserStats('test-user-id');

      expect(result).toEqual({
        profileCompletionRate: 100, // 所有字段都已填写
        hasAvatar: true,
        hasBasicInfo: true,
        hasContactInfo: true,
      });
    });

    it('应该正确计算部分完成的用户信息', async () => {
      const partialUser = {
        ...mockUser,
        firstName: 'John',
        lastName: 'Doe',
        avatar: null,
        bio: null,
        birthday: null,
        gender: null,
      };
      userRepository.findOne.mockResolvedValue(partialUser);

      const result = await service.getUserStats('test-user-id');

      expect(result.profileCompletionRate).toBe(33); // 只有firstName和lastName
      expect(result.hasAvatar).toBe(false);
      expect(result.hasBasicInfo).toBe(true);
    });

    it('当用户不存在时应该抛出NotFoundException', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserStats('non-existent-id'))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});
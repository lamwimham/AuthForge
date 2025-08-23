import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { OAuthService, OAuthUserData } from './oauth.service';
import { User, UserStatus } from '../../database/entities/user.entity';
import { OAuthProvider, OAuthProviderType } from '../../database/entities/oauth-provider.entity';
import { TokenService } from './token.service';
import { UserService } from './user.service';

describe('OAuthService', () => {
  let service: OAuthService;
  let userRepository: Repository<User>;
  let oauthProviderRepository: Repository<OAuthProvider>;
  let tokenService: TokenService;
  let userService: UserService;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: null,
    status: UserStatus.ACTIVE,
    emailVerified: true,
    oauthProviders: [],
  } as User;

  const mockOAuthProvider = {
    id: 'oauth-id',
    userId: 'user-id',
    provider: OAuthProviderType.GOOGLE,
    providerUserId: 'google-123',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: mockUser,
    updateTokens: jest.fn(),
  } as any;

  const mockOAuthData: OAuthUserData = {
    provider: 'google',
    providerId: 'google-123',
    email: 'test@example.com',
    displayName: 'Test User',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };

  const mockTokens = {
    accessToken: 'jwt-access-token',
    refreshToken: 'jwt-refresh-token',
    expiresIn: 900,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OAuthProvider),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateAuthTokens: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            createOAuthUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    oauthProviderRepository = module.get<Repository<OAuthProvider>>(getRepositoryToken(OAuthProvider));
    tokenService = module.get<TokenService>(TokenService);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateOAuthUser', () => {
    it('should login existing OAuth user', async () => {
      jest.spyOn(oauthProviderRepository, 'findOne').mockResolvedValue(mockOAuthProvider);
      jest.spyOn(tokenService, 'generateAuthTokens').mockResolvedValue(mockTokens);
      jest.spyOn(service as any, 'updateOAuthTokens').mockResolvedValue(undefined);

      const result = await service.validateOAuthUser(mockOAuthData);

      expect(result.user).toBe(mockUser);
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBe(mockTokens.refreshToken);
      expect(result.isNewUser).toBe(false);
    });

    it('should link OAuth to existing user with same email', async () => {
      jest.spyOn(oauthProviderRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(service as any, 'linkOAuthProvider').mockResolvedValue(undefined);
      jest.spyOn(tokenService, 'generateAuthTokens').mockResolvedValue(mockTokens);

      const result = await service.validateOAuthUser(mockOAuthData);

      expect(result.user).toBe(mockUser);
      expect(result.isNewUser).toBe(false);
    });

    it('should create new user for new OAuth login', async () => {
      const newUser = { ...mockUser, id: 'new-user-id' };
      
      jest.spyOn(oauthProviderRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(service as any, 'createUserFromOAuth').mockResolvedValue(newUser);
      jest.spyOn(tokenService, 'generateAuthTokens').mockResolvedValue(mockTokens);

      const result = await service.validateOAuthUser(mockOAuthData);

      expect(result.user).toBe(newUser);
      expect(result.isNewUser).toBe(true);
    });
  });

  describe('linkOAuthProvider', () => {
    it('should link OAuth provider to user successfully', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(oauthProviderRepository, 'findOne')
        .mockResolvedValueOnce(null) // 检查用户是否已绑定该类型
        .mockResolvedValueOnce(null); // 检查OAuth账户是否已被绑定
      jest.spyOn(oauthProviderRepository, 'create').mockReturnValue(mockOAuthProvider);
      jest.spyOn(oauthProviderRepository, 'save').mockResolvedValue(mockOAuthProvider);

      await service.linkOAuthProvider('user-id', mockOAuthData);

      expect(oauthProviderRepository.create).toHaveBeenCalled();
      expect(oauthProviderRepository.save).toHaveBeenCalled();
    });

    it('should throw error if provider already linked', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(oauthProviderRepository, 'findOne').mockResolvedValue(mockOAuthProvider);

      await expect(service.linkOAuthProvider('user-id', mockOAuthData))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('unlinkOAuthProvider', () => {
    it('should unlink OAuth provider successfully', async () => {
      const userWithProviders = {
        ...mockUser,
        passwordHash: 'hashed-password',
        oauthProviders: [mockOAuthProvider],
      };
      
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithProviders);
      jest.spyOn(oauthProviderRepository, 'findOne').mockResolvedValue(mockOAuthProvider);
      jest.spyOn(oauthProviderRepository, 'remove').mockResolvedValue(mockOAuthProvider);

      await service.unlinkOAuthProvider('user-id', OAuthProviderType.GOOGLE);

      expect(oauthProviderRepository.remove).toHaveBeenCalledWith(mockOAuthProvider);
    });

    it('should throw error if user has no password and only one OAuth provider', async () => {
      const userWithoutPassword = {
        ...mockUser,
        passwordHash: null,
        oauthProviders: [mockOAuthProvider],
      };
      
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithoutPassword);

      await expect(service.unlinkOAuthProvider('user-id', OAuthProviderType.GOOGLE))
        .rejects.toThrow('无法解绑最后一个登录方式，请先设置密码');
    });

    it('should throw error if OAuth provider not found', async () => {
      const userWithPassword = {
        ...mockUser,
        passwordHash: 'hashed-password',
        oauthProviders: [mockOAuthProvider, { ...mockOAuthProvider, id: 'another-oauth' }],
      };
      
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithPassword);
      jest.spyOn(oauthProviderRepository, 'findOne').mockResolvedValue(null);

      await expect(service.unlinkOAuthProvider('user-id', OAuthProviderType.GOOGLE))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserOAuthProviders', () => {
    it('should return user OAuth providers', async () => {
      const providers = [mockOAuthProvider];
      jest.spyOn(oauthProviderRepository, 'find').mockResolvedValue(providers);

      const result = await service.getUserOAuthProviders('user-id');

      expect(result).toEqual(providers);
      expect(oauthProviderRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        select: ['id', 'provider', 'createdAt', 'updatedAt'],
      });
    });
  });
});
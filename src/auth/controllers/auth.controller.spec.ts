import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { VerificationCodeService } from '../services/verification-code.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { User, UserStatus } from '../../database/entities/user.entity';
import { RateLimitGuard } from '../guards/rate-limit.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let verificationCodeService: VerificationCodeService;

  const mockUser: User = {
    id: 'user-id',
    email: 'test@example.com',
    username: 'testuser',
    status: UserStatus.ACTIVE,
    passwordHash: 'hash',
    emailVerified: true,
    phoneVerified: false,
    mfaEnabled: false,
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
    oauthProviders: [],
    mfaDevices: [],
    firstName: 'Test',
    lastName: 'User',
    isLocked: () => false,
    isActive: () => true,
    hasVerifiedContact: () => true,
    incrementFailedAttempts: () => {},
    resetFailedAttempts: () => {},
    hasActiveMfaDevices: () => false,
    getActiveMfaDevices: () => [],
    getFullName: () => 'Test User',
    getDisplayName: () => 'Test User',
    isProfileComplete: () => true,
    getAge: () => null,
    hasAvatar: () => false,
  } as User;

  const mockAuthResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 900,
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
            logoutAll: jest.fn(),
            getUserProfile: jest.fn(),
            resetPassword: jest.fn(),
            changePassword: jest.fn(),
            verifyEmail: jest.fn(),
            verifyPhone: jest.fn(),
          },
        },
        {
          provide: VerificationCodeService,
          useValue: {
            sendVerificationCode: jest.fn(),
            verifyCode: jest.fn(),
          },
        },
        {
          provide: RateLimitGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            incr: jest.fn(),
            expire: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    verificationCodeService = module.get<VerificationCodeService>(VerificationCodeService);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        password: 'StrongPassword123!',
        confirmPassword: 'StrongPassword123!',
      };

      jest.spyOn(authService, 'register').mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(result.success).toBe(true);
      expect(result.message).toContain('注册成功');
      expect(result.data?.id).toBe(mockUser.id);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginDto: LoginDto = {
        identifier: 'test@example.com',
        password: 'StrongPassword123!',
      };

      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthResponse);

      const result = await controller.login(
        loginDto,
        'Chrome/120.0',
        '127.0.0.1',
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('登录成功');
      expect(result.data).toBe(mockAuthResponse);
      expect(authService.login).toHaveBeenCalledWith({
        ...loginDto,
        deviceInfo: 'Chrome/120.0',
        ipAddress: '127.0.0.1',
      });
    });

    it('should handle MFA required response', async () => {
      const loginDto: LoginDto = {
        identifier: 'test@example.com',
        password: 'StrongPassword123!',
      };

      jest.spyOn(authService, 'login').mockResolvedValue({
        mfaRequired: true,
      } as any);

      const result = await controller.login(
        loginDto,
        'Chrome/120.0',
        '127.0.0.1',
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('MFA验证');
      expect(result.data?.mfaRequired).toBe(true);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const refreshTokenDto = { refreshToken: 'refresh-token' };
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      };

      jest.spyOn(authService, 'refreshToken').mockResolvedValue(newTokens);

      const result = await controller.refresh(refreshTokenDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('令牌刷新成功');
      expect(result.data).toBe(newTokens);
      expect(authService.refreshToken).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const logoutDto = { refreshToken: 'refresh-token' };
      const authorization = 'Bearer access-token';

      jest.spyOn(authService, 'logout').mockResolvedValue();

      const result = await controller.logout(logoutDto, authorization);

      expect(result.success).toBe(true);
      expect(result.message).toBe('登出成功');
      expect(authService.logout).toHaveBeenCalledWith('refresh-token', 'access-token');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user profile', async () => {
      const userProfile = {
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        emailVerified: mockUser.emailVerified,
        phoneVerified: mockUser.phoneVerified,
        mfaEnabled: mockUser.mfaEnabled,
        status: mockUser.status,
        createdAt: mockUser.createdAt,
      };

      jest.spyOn(authService, 'getUserProfile').mockResolvedValue(userProfile);

      const result = await controller.getCurrentUser(mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe('获取用户信息成功');
      expect(result.data).toBe(userProfile);
      expect(authService.getUserProfile).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const changePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      jest.spyOn(authService, 'changePassword').mockResolvedValue();

      const result = await controller.changePassword(mockUser, changePasswordDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('密码修改成功');
      expect(authService.changePassword).toHaveBeenCalledWith(
        mockUser.id,
        'OldPassword123!',
        'NewPassword123!',
        'NewPassword123!',
      );
    });
  });

  describe('sendVerificationCode', () => {
    it('should send verification code', async () => {
      const sendCodeDto = {
        target: 'test@example.com',
        type: 'email_verify' as const,
      };

      jest.spyOn(verificationCodeService, 'sendVerificationCode').mockResolvedValue();

      const result = await controller.sendVerificationCode(sendCodeDto);

      expect(result.success).toBe(true);
      expect(result.message).toContain('验证码已发送');
      expect(verificationCodeService.sendVerificationCode).toHaveBeenCalledWith(
        'test@example.com',
        'email_verify',
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const verifyCodeDto = { verificationCode: '123456' };

      jest.spyOn(authService, 'verifyEmail').mockResolvedValue();

      const result = await controller.verifyEmail(mockUser, verifyCodeDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('邮箱验证成功');
      expect(authService.verifyEmail).toHaveBeenCalledWith(mockUser.id, '123456');
    });
  });
});
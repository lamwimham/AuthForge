import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { User, UserStatus } from '../../database/entities/user.entity';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let authService: AuthService;
  let reflector: Reflector;

  const mockUser: User = {
    id: 'user-id',
    email: 'test@example.com',
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
    isLocked: () => false,
    isActive: () => true,
    hasVerifiedContact: () => true,
    incrementFailedAttempts: () => {},
    resetFailedAttempts: () => {},
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    authService = module.get<AuthService>(AuthService);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (headers: any = {}): ExecutionContext => {
    const mockRequest = {
      headers,
      user: undefined,
    };
    
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  describe('canActivate', () => {
    it('should allow access to public routes', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      
      const context = createMockContext();
      const result = await guard.canActivate(context);
      
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      
      const context = createMockContext();
      
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(authService, 'validateAccessToken').mockResolvedValue(null);
      
      const context = createMockContext({
        authorization: 'Bearer invalid-token',
      });
      
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow access with valid token', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(authService, 'validateAccessToken').mockResolvedValue(mockUser);
      
      const context = createMockContext({
        authorization: 'Bearer valid-token',
      });
      
      const result = await guard.canActivate(context);
      const request = context.switchToHttp().getRequest();
      
      expect(result).toBe(true);
      expect(request.user).toBe(mockUser);
    });

    it('should handle different authorization header formats', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      
      const contextInvalidFormat = createMockContext({
        authorization: 'InvalidFormat token',
      });
      
      await expect(guard.canActivate(contextInvalidFormat)).rejects.toThrow(UnauthorizedException);
    });
  });
});
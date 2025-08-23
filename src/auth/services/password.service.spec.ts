import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(12),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'TestPassword123!';
      const hash = await service.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await service.hashPassword(password);
      
      const isValid = await service.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await service.hashPassword(password);
      
      const isValid = await service.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const password = 'TestPassword123!';
      const invalidHash = 'invalid-hash';
      
      const isValid = await service.verifyPassword(password, invalidHash);
      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const strongPassword = 'StrongPass123!';
      const result = service.validatePasswordStrength(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(3);
    });

    it('should reject weak password', () => {
      const weakPassword = 'weak';
      const result = service.validatePasswordStrength(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(3);
    });

    it('should identify specific password weaknesses', () => {
      const passwordWithoutUppercase = 'noupppercase123!';
      const result = service.validatePasswordStrength(passwordWithoutUppercase);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个大写字母');
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate password with specified length', () => {
      const length = 16;
      const password = service.generateRandomPassword(length);
      
      expect(password).toBeDefined();
      expect(password.length).toBe(length);
    });

    it('should generate strong password', () => {
      const password = service.generateRandomPassword();
      const result = service.validatePasswordStrength(password);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(3);
    });

    it('should generate different passwords', () => {
      const password1 = service.generateRandomPassword();
      const password2 = service.generateRandomPassword();
      
      expect(password1).not.toBe(password2);
    });
  });
});
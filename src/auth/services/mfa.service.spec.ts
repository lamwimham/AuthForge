import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MfaService } from './mfa.service';
import { MfaDevice, MfaDeviceType, MfaDeviceStatus } from '../../database/entities/mfa-device.entity';
import { User } from '../../database/entities/user.entity';
import { VerificationCodeService } from './verification-code.service';

describe('MfaService', () => {
  let service: MfaService;
  let mfaDeviceRepository: Repository<MfaDevice>;
  let userRepository: Repository<User>;
  let verificationCodeService: VerificationCodeService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    username: 'testuser',
    mfaEnabled: false,
  } as User;

  const mockMfaDevice = {
    id: 'device-id',
    userId: 'user-id',
    type: MfaDeviceType.TOTP,
    name: '测试设备',
    status: MfaDeviceStatus.PENDING,
    secret: 'encrypted-secret',
    activate: jest.fn(),
    recordUsage: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        {
          provide: getRepositoryToken(MfaDevice),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config = {
                APP_NAME: 'AuthForge',
                MFA_ENCRYPTION_KEY: 'test-key',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: VerificationCodeService,
          useValue: {
            sendVerificationCode: jest.fn(),
            verifyCode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    mfaDeviceRepository = module.get<Repository<MfaDevice>>(getRepositoryToken(MfaDevice));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verificationCodeService = module.get<VerificationCodeService>(VerificationCodeService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setupTotpDevice', () => {
    it('should setup TOTP device successfully', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(mfaDeviceRepository, 'create').mockReturnValue(mockMfaDevice);
      jest.spyOn(mfaDeviceRepository, 'save').mockResolvedValue(mockMfaDevice);
      jest.spyOn(service as any, 'setupBackupCodes').mockResolvedValue(undefined);

      const result = await service.setupTotpDevice('user-id', '测试设备');

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeUrl');
      expect(result).toHaveProperty('backupCodes');
      expect(mfaDeviceRepository.create).toHaveBeenCalled();
      expect(mfaDeviceRepository.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.setupTotpDevice('invalid-user-id', '测试设备'))
        .rejects.toThrow('用户不存在');
    });
  });

  describe('setupSmsDevice', () => {
    it('should setup SMS device successfully', async () => {
      jest.spyOn(mfaDeviceRepository, 'create').mockReturnValue(mockMfaDevice);
      jest.spyOn(mfaDeviceRepository, 'save').mockResolvedValue(mockMfaDevice);
      jest.spyOn(verificationCodeService, 'sendVerificationCode').mockResolvedValue();

      await service.setupSmsDevice('user-id', '+8613800138000', '测试短信设备');

      expect(mfaDeviceRepository.create).toHaveBeenCalledWith({
        userId: 'user-id',
        type: MfaDeviceType.SMS,
        name: '测试短信设备',
        target: '+8613800138000',
        status: MfaDeviceStatus.PENDING,
      });
      expect(verificationCodeService.sendVerificationCode).toHaveBeenCalled();
    });
  });

  describe('verifyMfaSetup', () => {
    it('should verify TOTP setup successfully', async () => {
      const totpDevice = {
        ...mockMfaDevice,
        type: MfaDeviceType.TOTP,
        status: MfaDeviceStatus.PENDING,
      };
      
      jest.spyOn(mfaDeviceRepository, 'findOne').mockResolvedValue(totpDevice);
      jest.spyOn(service as any, 'verifyTotpCode').mockReturnValue(true);
      jest.spyOn(mfaDeviceRepository, 'save').mockResolvedValue(totpDevice);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'save').mockResolvedValue({ ...mockUser, mfaEnabled: true });

      await service.verifyMfaSetup('user-id', 'device-id', '123456');

      expect(totpDevice.activate).toHaveBeenCalled();
      expect(mfaDeviceRepository.save).toHaveBeenCalledWith(totpDevice);
    });

    it('should throw error if device not found', async () => {
      jest.spyOn(mfaDeviceRepository, 'findOne').mockResolvedValue(null);

      await expect(service.verifyMfaSetup('user-id', 'invalid-device-id', '123456'))
        .rejects.toThrow('MFA设备不存在');
    });

    it('should throw error if device already activated', async () => {
      const activeDevice = {
        ...mockMfaDevice,
        status: MfaDeviceStatus.ACTIVE,
      };
      
      jest.spyOn(mfaDeviceRepository, 'findOne').mockResolvedValue(activeDevice);

      await expect(service.verifyMfaSetup('user-id', 'device-id', '123456'))
        .rejects.toThrow('设备已激活或已禁用');
    });

    it('should throw error if verification code is invalid', async () => {
      const totpDevice = {
        ...mockMfaDevice,
        type: MfaDeviceType.TOTP,
        status: MfaDeviceStatus.PENDING,
      };
      
      jest.spyOn(mfaDeviceRepository, 'findOne').mockResolvedValue(totpDevice);
      jest.spyOn(service as any, 'verifyTotpCode').mockReturnValue(false);

      await expect(service.verifyMfaSetup('user-id', 'device-id', 'invalid-code'))
        .rejects.toThrow('验证码无效');
    });
  });

  describe('getUserMfaDevices', () => {
    it('should return user MFA devices', async () => {
      const devices = [mockMfaDevice];
      jest.spyOn(mfaDeviceRepository, 'find').mockResolvedValue(devices);

      const result = await service.getUserMfaDevices('user-id');

      expect(result).toEqual(devices);
      expect(mfaDeviceRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        select: ['id', 'type', 'name', 'status', 'target', 'createdAt', 'lastUsedAt', 'usageCount'],
      });
    });
  });

  describe('disableMfaDevice', () => {
    it('should disable MFA device successfully', async () => {
      const device = {
        ...mockMfaDevice,
        disable: jest.fn(),
      };
      
      jest.spyOn(mfaDeviceRepository, 'findOne').mockResolvedValue(device);
      jest.spyOn(mfaDeviceRepository, 'save').mockResolvedValue(device);
      jest.spyOn(mfaDeviceRepository, 'count').mockResolvedValue(1);

      await service.disableMfaDevice('user-id', 'device-id');

      expect(device.disable).toHaveBeenCalled();
      expect(mfaDeviceRepository.save).toHaveBeenCalledWith(device);
    });

    it('should disable user MFA when no active devices left', async () => {
      const device = {
        ...mockMfaDevice,
        disable: jest.fn(),
      };
      
      jest.spyOn(mfaDeviceRepository, 'findOne').mockResolvedValue(device);
      jest.spyOn(mfaDeviceRepository, 'save').mockResolvedValue(device);
      jest.spyOn(mfaDeviceRepository, 'count').mockResolvedValue(0);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'save').mockResolvedValue({ ...mockUser, mfaEnabled: false });

      await service.disableMfaDevice('user-id', 'device-id');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ mfaEnabled: false })
      );
    });

    it('should throw error if device not found', async () => {
      jest.spyOn(mfaDeviceRepository, 'findOne').mockResolvedValue(null);

      await expect(service.disableMfaDevice('user-id', 'invalid-device-id'))
        .rejects.toThrow('MFA设备不存在');
    });
  });
});